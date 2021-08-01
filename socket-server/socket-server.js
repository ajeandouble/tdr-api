const userModel = require('../database/schemas/userModel');

const sockets = {};

module.exports.ioNotifySend = async ({ msg, from, to }) => {
  console.log(this.name);
  console.log(msg, from, to);
  if (sockets[to]) {
    sockets[to].emit('fromAPI', { type: 'SENT_MSG', from, msg: msg });
  }
}

module.exports.io = async (io, firebaseAdmin) => {
  io.on('connection', (socket) => {
    let userId = undefined;
    console.log(`Client connected: ${socket.id}`);
    socket.emit('fromAPI', 'yo');
    socket.on('fromClient', async data => {
      if (!data.authorization) return ;
      try {
        let idToken;
        console.log(data);
        if (data.authorization && data.authorization.startsWith("Bearer")) {
          idToken = data.authorization.split('Bearer ')[1];
        } else {
          throw Error("No token found");
        }
        const decodedToken = await firebaseAdmin.auth().verifyIdToken(idToken);
        console.log(decodedToken)
        if (!decodedToken) {
          throw Error("Can't decode token");
        }
        const decodedUserId = decodedToken.user_id;
        userId = decodedUserId;
        const user = await userModel.findOne({ userId: decodedUserId });
        if (!user) {
          throw Error("Can't find user");
        }
        sockets[decodedUserId] = socket;
        console.log(sockets);
      } catch (err) {
        console.log(err);
      }
    });
    socket.on('disconnect', () => {
      console.log(`${socket.id} disconnected`);
      if (userId && sockets[userId]) delete sockets[userId];
    });
  });
  console.log('socket.io');
};
