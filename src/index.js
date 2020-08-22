const path = require('path')
const express = require('express')
const http = require('http')
const socketio = require('socket.io')
const Filter = require('bad-words')
const {getMessage} = require('./utils/message')
const { generateLocationMessage } = require('./utils/message')
const { addUser, removeUsers, getUser, getUsersInRoom } = require('./utils/users')

//initiating express
const app = express()

// creating server
const server = http.createServer(app)

// initiating socket
const io = socketio(server)

//selecting port
const port = process.env.PORT || 3000

//getting public directory path
const publicDirectory = path.join(__dirname, '../public')

//using public directory path
app.use(express.static(publicDirectory))

// ---------------stating io connection to chat ---------------


io.on('connection', (socket) => {
    console.log('New WebSocket Connection')

    socket.on('join', (options, callback) => {
        const { error, user } = addUser({ id: socket.id, ...options })
        if(error) {
            return callback(error)
        }

        socket.join(user.room)

        // Welcome Message (First time once)
        socket.emit('message', getMessage(user.username, 'Welcome!'))

        //broadcast to all except sender ( Joining message to all)
        socket.broadcast.to(user.room).emit('message', getMessage(`${user.username} has joined!`))

        io.to(user.room).emit('roomData', {
            room: user.room,
            users: getUsersInRoom(user.room)
        })

        callback()
        
    }) 
    //listen to client
    socket.on('sendMessage', (message,callback) => {
        const user = getUser(socket.id)
        const filter = new Filter()
        if(filter.isProfane(message)){
            return callback('Profinity is not allowed!')
        }
        //send to all client
        io.to(user.room).emit('message', getMessage(user.username, message))
        callback()
    })

    // listening client to get location
    socket.on('sendLocation', (coord, callback) => {
        const user = getUser(socket.id)
        io.to(user.room).emit('locationMessage', generateLocationMessage(user.username, `https://google.com/maps?q=${coord.latitude},${coord.longitude}`))
        callback()
    })

    //leaving message to all (except who leave)
    socket.on('disconnect', () => {
        const user = removeUsers(socket.id)
        if(user) {
            io.to(user.room).emit('message', getMessage(`${user.username} has left`))
            io.to(user.room).emit('roomData',{
                room: user.room,
                users: getUsersInRoom(user.room)
            })
        }
        
    })
})

//--------------- End of chat -------------------

// server stating
server.listen(port, () => {
    console.log(`Server up on port ${port}`)
})