const path = require('path');
const http = require('http');
const express = require('express');
const socketio = require('socket.io');
const Filter = require('bad-words');
const { generateMessage, generateLocationMessage } = require('./utils/messages');
const { addUser, removeUser, getUser, getUserInRoom } = require('./utils/users');

const app = express();
const server = http.createServer(app);
const io = socketio(server);

const port = process.env.PORT;
const publicDirectory = path.join(__dirname, './../public');

app.use(express.static(publicDirectory));

io.on('connection', (socket) => {
    console.log('New WebSocket connection!');

    // socket.emit, io.emit, socket.broadcast.emit
    // io.to(room).emit, socket.broadcast.to(room).emit
  
    socket.on('join', (options, callback) => {
        const { error, user } = addUser({ id: socket.id, ...options });

        if (error) {
            return callback(error);
        }
        socket.join(user.room);

        socket.emit('message', generateMessage('Admin', 'Welcome!'));
        socket.broadcast.to(user.room).emit('message', generateMessage('Admin', `${user.username} has joined!`));
        
        io.to(user.room).emit('roomData', {
            room: user.room,
            users: getUserInRoom(user.room)
        });

        callback();
    });

    socket.on('sendMessage', (msg, callback) => {
        const user = getUser(socket.id);

        if (user) {
            const filter = new Filter();
            
            if (filter.isProfane(msg)) {
                return callback('Profanity not allowed!');
            }
            
            io.to(user.room).emit('message', generateMessage(user.username, msg));
            callback();
        }
    });
    
    socket.on('sendLocation', (coords, callback) => {
        const user = getUser(socket.id);

        if (user) {
            io.to(user.room).emit('locationMessage', generateLocationMessage(user.username, `https://google.com/maps?q=${coords.latitude},${coords.longitude}`));
            callback('Location shared!');
        }
    });

    socket.on('disconnect', () => {
        const user = removeUser(socket.id);

        if (user) {
            io.to(user.room).emit('message', generateMessage('Admin', `${user.username} has left!`));

            io.to(user.room).emit('roomData', {
                room: user.room,
                users: getUserInRoom(user.room)
            });
        }
    });
});

server.listen(port, () => {
    console.log('Server running on port: ' + port);
});