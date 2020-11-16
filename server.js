// Customization
const { emit } = require("process");
const { Socket } = require("socket.io");

const port = 3000;

// Libraries
const UUIDlib = require("uuid");
const express = require("express"), app = express();
const server = require("http").createServer(app)
  , io = require("socket.io")(server);

app.set("client", __dirname + "/client/"); // "client" is used to mean the client subfolder
app.use(express.static("client")); // default here


app.get('/', function(req, res){ // when a new connection to the homepage is recieved
    res.sendFile(__dirname + '/client/index.html'); // send them to the homepage
});
app.get('/chat', function(req, res){
    res.sendFile(__dirname + '/client/chat.html');
});
app.get('/login', function(req, res){
    res.sendFile(__dirname + '/client/login.html');
});

app.get('/', function(req, res){
    console.log('app.get');
});

server.listen(port);
console.log(`Server Listening on port ${port}`);

var numUsers = 0; // number of active users
var sessions = []; // global used to track active sessions
var date = new Date() // class used to generate date
var sockets = [];


/**
 * This function creates a new user with given params
 * @param {string} UUID      UUID of user - used to reauthenticate connected clients
 * @param {string} username  the username of the client
 * @param {int} exdays    the number of days before the client expires (0 for session)
 */
function createSession(UUID, username, exdays, inChat, id){
    sessions.push({
        UUID: UUID,
        username: username,
        expiration: date.getTime() + (exdays*24*60*60*1000),
        inChat: inChat,
        id: id
    })
    numUsers++;
}


function findSessionByUUID(_uuid){
    for(i in sessions){
        if(_uuid == sessions[i].UUID){
            return i;
        }
    }
    return -1;
}

function findSessionsByID(_id){
    for(i in sessions){
        if(_id == sessions[i].id){
            return i;
        }
    }
    return -1;
}

/**
 * this will validate a UUID / see if it is a registered user
 * @param {string} _uuid     UUID to be verified
 */
function validateUUID(_uuid){
    if(!UUIDlib.validate(_uuid)){
        return false;
    }
    for(i in sessions){
        if(sessions[i].UUID == _uuid){
            return true;
        }
    }
    return false;
}

/**
 * Checks to see if a username is valid. 
 * Could be used to check for profanity and other abuses
 * @param {*} username 
 */
function validateUsername(username){
    if(username == ''){
        return false;
    }
    for(i in sessions){
        if(username == sessions[i].username){
            return false;
        }
    }
    return true;
}


function sendMessage(data){
    for(i in sockets){
        sockets[i].emit('addMessage', {
            message: data.message,
            username: data.username
        });
    }
}

// when a socket connects
io.sockets.on('connection', (socket) => {
    console.log('new connection');
    sockets[socket.id] = socket;

    socket.on('disconnecting', () => {
        var i = findSessionsByID(socket.id);
        console.log(`disconnection with i = ${i}`);
        if(i >= 0){
            if(sessions[i].inChat){
                sessions[i].inChat = false;
                sendMessage({
                    message: `${sessions[findSessionsByID(socket.id)].username} has left the chat.`,
                    username: 'Server'
                });
                console.log(`${sessions[findSessionsByID(socket.id)].username} left the chatroom`);
            }
        }
        delete sockets[socket.id];
    });

    // anytime a page is loaded, validate user
    socket.on('validate', (_uuid) => {
        console.log(`validation attempt $UUID=${_uuid}`);
        // if the UUID is registered (they've connected before) and it is a valid uuid
        if(validateUUID(_uuid)){
            socket.emit('redirect', {
                path: '/chat',
                reason: ''
            });
            console.log('   validation success');
            sessions[findSessionByUUID(_uuid)].id = socket.id;
        }
        // if the uuid is not recognized
        else{
            socket.emit('redirect', {
                path: '/login',
                reason: ''
            });
            console.log('   validation failure');
        }
    });

    // if the user attempts to log in
    socket.on('login', (data) => {
        console.log('login attempt');
        // check their username
        if(validateUsername(data.username)){
            _uuid = UUIDlib.v4()
            createSession(_uuid, data.username, data.remember * 7, false, socket.id);

            // send them a loginSuccess
            socket.emit('loginSuccess', {
                UUID: _uuid, 
                exdays: data.remember * 7,
                redirect: '/chat'
            });
            console.log(`    New User: $UUID=${_uuid}, $username=${data.username}`)
        }
        else{
            // send them a failure
            console.log('    Login Failure; reason: ' + 'Username is not valid');
            socket.emit('loginFailure', 'Username is not valid');
        }
    });

    // join chatroom
    socket.on('joinChatroom', (data) => {
        console.log("attempt to join chatroom");
        if(validateUUID(data._uuid)){
            sendMessage({
                message: `${sessions[findSessionByUUID(data._uuid)].username} has joined the chat!`,
                username: 'Server'
            });
            sessions[findSessionByUUID(_uuid)].id = socket.id;
            sessions[findSessionByUUID(_uuid)].inChat = true;
            
            console.log(`${sessions[findSessionByUUID(data._uuid)].username} join the chatroom`);
        }
        else{
            socket.emit('redirect', {
                path: '/login',
                reason: ''
            });
            console.log('joinChatroom with Invalid Credentials');
        }
    });

    // when a message is sent
    socket.on('sendServerMessage', (data) => {
        console.log("new message");
        if(validateUUID(data._uuid)){
            sendMessage({
                message: data.message,
                username: sessions[findSessionByUUID(data._uuid)].username
            });
        }
    });
});