import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fetchQuote, generateCode, startCountdown } from './helpers';
import { QuoteLengthType, RaceStateType, SocketEvent } from 'shared/types';

const PORT = process.env.PORT || 8080;

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

const clientRooms: { [key: string]: string } = {};
const roomState: { [key: string]: RaceStateType } = {};

io.on('connection', (socket) => {
  console.log('New Connection: ', socket.id);

  socket.on(SocketEvent.CreateRoom, (quoteLength: QuoteLengthType) => {
    const roomCode = generateCode(6);

    clientRooms[socket.id] = roomCode;
    roomState[roomCode] = {
      players: { player1: { id: socket.id, wordIndex: 0, charIndex: 0 } },
      quoteLength: quoteLength,
    };

    socket.join(roomCode);
    socket.emit(SocketEvent.HasJoinedRoom, roomCode);
    io.sockets.to(roomCode).emit(SocketEvent.RoomState, roomState[roomCode]);
  });

  socket.on(SocketEvent.JoinRoom, (roomCode: string) => {
    if (!roomState.hasOwnProperty(roomCode)) {
      socket.emit(SocketEvent.JoinRoomError);
      return;
    }

    clientRooms[socket.id] = roomCode;
    roomState[roomCode].players.player2 = {
      id: socket.id,
      wordIndex: 0,
      charIndex: 0,
    };
    socket.join(roomCode);
    socket.emit(SocketEvent.HasJoinedRoom, roomCode);

    fetchQuote(roomState[roomCode].quoteLength)
      .then((quote: string) => {
        roomState[roomCode].testText = quote;
        io.sockets.to(roomCode).emit(SocketEvent.TestText, quote);
      })
      .then(() => {
        startCountdown(roomCode, io);
      });

    io.sockets.to(roomCode).emit(SocketEvent.RoomState, roomState[roomCode]);
  });

  socket.on(
    SocketEvent.CaretPositionChange,
    ({ wordIndex, charIndex }: { wordIndex: number; charIndex: number }) => {
      const roomCode = clientRooms[socket.id];

      if (!roomCode || !roomState[roomCode]) {
        return;
      }

      const player =
        roomState[roomCode].players.player1.id === socket.id ? 'player1' : 'player2';

      roomState[roomCode].players[player] = {
        id: roomState[roomCode].players[player]!.id,
        wordIndex,
        charIndex,
      };

      socket.broadcast
        .to(roomCode)
        .emit(SocketEvent.CaretPositionChange, { player, wordIndex, charIndex });
    }
  );

  socket.on(SocketEvent.Result, (result) => {
    const roomCode = clientRooms[socket.id];

    if (!roomCode || !roomState.hasOwnProperty(roomCode)) {
      console.error("room doesn't exist`");
      return;
    }

    const player =
      roomState[roomCode].players.player1.id === socket.id ? 'player1' : 'player2';

    const opponentPlayer = player === 'player1' ? 'player2' : 'player1';

    if (roomState[roomCode].players[player]) {
      roomState[roomCode].players[player]!.result = result;

      const typedWords = roomState[roomCode].testText?.split(' ')!;
      io.sockets.to(roomCode).emit(SocketEvent.CaretPositionChange, {
        player,
        wordIndex: typedWords.length - 1,
        charIndex: typedWords[typedWords.length - 1].length,
      });
    }

    if (roomState[roomCode].players[opponentPlayer]?.result) {
      io.sockets
        .to(roomCode)
        .emit(SocketEvent.PlayersState, roomState[roomCode].players);
    }
  });

  socket.on(SocketEvent.PlayAgain, () => {
    const roomCode = clientRooms[socket.id];

    if (!roomCode || !roomState.hasOwnProperty(roomCode)) {
      console.error("room doesn't exist");
      return;
    }

    let state = roomState[roomCode];

    const player = state.players.player1.id === socket.id ? 'player1' : 'player2';

    const opponentPlayer = player === 'player1' ? 'player2' : 'player1';

    if (state.players[opponentPlayer]?.playAgain) {
      roomState[roomCode] = {
        testText: '',
        quoteLength: state.quoteLength,
        players: {
          player1: { id: state.players.player1.id, wordIndex: 0, charIndex: 0 },
          player2: { id: state.players.player2!.id, wordIndex: 0, charIndex: 0 },
        },
      };

      io.sockets.to(roomCode).emit(SocketEvent.RoomState, roomState[roomCode]);

      fetchQuote(state.quoteLength)
        .then((quote: string) => {
          roomState[roomCode].testText = quote;
          io.sockets.to(roomCode).emit(SocketEvent.TestText, quote);
        })
        .then(() => {
          startCountdown(roomCode, io);
        });
    } else {
      roomState[roomCode].players[player]!.playAgain = true;

      io.to(state.players[opponentPlayer]!.id).emit(SocketEvent.OpponentPlayAgain);
    }
  });

  const handleRoomDisconnect = () => {
    const roomCode = clientRooms[socket.id];

    if (!roomCode || !roomState[roomCode]) {
      return;
    }

    delete clientRooms[socket.id];

    const player =
      roomState[roomCode].players.player1.id === socket.id ? 'player1' : 'player2';

    const opponentPlayerState =
      roomState[roomCode].players[player === 'player1' ? 'player2' : 'player1'];

    if (!opponentPlayerState || opponentPlayerState?.disconnected) {
      delete roomState[roomCode];
    } else {
      roomState[roomCode].players[player]!.disconnected = true;
      io.to(opponentPlayerState.id).emit(SocketEvent.OpponentDisconnected);
    }
  };

  socket.on(SocketEvent.LeaveRoom, handleRoomDisconnect);
  socket.on('disconnect', handleRoomDisconnect);
});

httpServer.listen(PORT);
