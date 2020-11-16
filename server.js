// Customization
const port = 3000;

// Libraries
const UUIDlib = require("uuid"); // used to create UUIDs

const express = require("express"), app = express();
const server = require("http").createServer(app)
  , io = require("socket.io")(server);

app.set("client", __dirname + "/client/");
app.use(express.static("client"));

// when someone connects to homepage
app.get('/', function(req, res){
    // send them to homepage
    res.sendFile(__dirname + '/client/index.html');
});
// when someone connects to /chat
app.get('/chat', function(req, res){
    // send them to chat
    res.sendFile(__dirname + '/client/chat.html');
});
// when someone connects to /login
app.get('/login', function(req, res){
    // send them to login
    res.sendFile(__dirname + '/client/login.html');
});

// start listening on the port specified
server.listen(port);
console.log(`Server Listening on port ${port}`);

// globals
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

/**
 * Locates and returns the session index based on the UUID
 *     returns -1 on failure
 * @param {UUID} _uuid 
 */
function findSessionByUUID(_uuid){
    for(i in sessions){
        if(_uuid == sessions[i].UUID){
            return i;
        }
    }
    return -1;
}

/**
 * Finds a session based on the socket.id
 *     returns index of socket or -1 if not found
 * @param {socket.id} _id 
 */
function findSessionByID(_id){
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

/**
 * sends a message to the entire server/all sockets
 * @param {} data 
 */
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

    // when the socket disconnects
    socket.on('disconnecting', () => {
        // get their session index
        var i = findSessionByID(socket.id);
        // if they are a session
        if(i >= 0){
            console.log(`${sessions[findSessionByID(socket.id)].UUID}:: disconnecting`);
            // notify server they left if they are inChat
            if(sessions[i].inChat){
                sessions[i].inChat = false
                sendMessage({
                    message: `${sessions[findSessionByID(socket.id)].username} has left the chat`,
                    username: 'Server'
                });
                console.log(`    ${sessions[findSessionByID(socket.id)].username} left the chatroom`);
            }
        }
        // if they are not a session
        else{
            console.log('unknown socket dicsonnecting');
        }
        // remove them from sockets
        delete sockets[socket.id];
    });


    // anytime a page is loaded, validate user
    socket.on('validate', (_uuid) => {
        console.log(`${_uuid}:: validation attempt`);
        // if the UUID is registered (they've connected before) and it is a valid uuid
        if(validateUUID(_uuid)){
            // send them to chat
            socket.emit('redirect', {
                path: '/chat',
                reason: ''
            });
            console.log(`    ${_uuid}:: validation success`);
            sessions[findSessionByUUID(_uuid)].id = socket.id;
        }
        // if the uuid is not recognized
        else{
            // send them to login
            socket.emit('redirect', {
                path: '/login',
                reason: ''
            });
            console.log(`    ${_uuid}:: validation failure`);
        }
    });


    // if the user attempts to log in
    socket.on('login', (data) => {
        console.log(`login attempt`);
        // check their username
        if(validateUsername(data.username)){
            // create and add them to sessions
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
            console.log(`    ${data._uuid}:: failed login; reason 'Username is not valid'`);
            socket.emit('loginFailure', 'Username is not valid');
        }
    });


    // join chatroom
    socket.on('joinChatroom', (data) => {
        console.log(`${data._uuid}:: attempt to join chatroom`);
        // validate their connection
        if(validateUUID(data._uuid)){
            // notify server
            sendMessage({
                message: `${sessions[findSessionByUUID(data._uuid)].username} has joined the chat!`,
                username: 'Server'
            });
            // update their status
            sessions[findSessionByUUID(_uuid)].id = socket.id;
            sessions[findSessionByUUID(_uuid)].inChat = true;
            
            console.log(`    ${data._uuid}:: joined the chatroom with username ${sessions[findSessionByUUID(data._uuid)].username}`);
        }
        // if they are not a valid login
        else{
            // send them to login
            socket.emit('redirect', {
                path: '/login',
                reason: ''
            });
            console.log(`    ${data._uuid}:: failed to joing chartoom; reason 'invalid uuid'`);
        }
    });


    // when a message is sent
    socket.on('sendServerMessage', (data) => {
        console.log(`${data._uuid}:: sent message '${data.message}'`);
        // check their UUID
        if(validateUUID(data._uuid)){
            sendMessage({
                message: data.message,
                username: sessions[findSessionByUUID(data._uuid)].username
            });
        }
    });


    // if the user logs out
    socket.on('logout', (data) => {
        // check their UUID
        if(validateUUID(data._uuid)){
            console.log(`${data._uuid}:: logout`)
            // notify server
            sendMessage({
                message: `${sessions[findSessionByUUID(data._uuid)].username} has left the chat`,
                username: 'Server'
            });
            // remove them
            delete sessions[findSessionByUUID(data._uuid)];
        }
        // even if they are not a valid UUID
        // send them to login
        socket.emit('redirect', {
            path: '/login',
            reason: ''
        });
    });
});