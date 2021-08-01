const router = require('express').Router();
const { ioNotifySend } = require('./socket-server/socket-server');

const userModel = require('./database/schemas/userModel.js');
const messagesModel = require('./database/schemas/messagesModel.js');

router.use('/test', async (_, res) => {
  console.log('userId', res.locals.userId);
  const test = await userModel.findOne({ userId: res.locals.userId });
  console.log(test);

  res.status(200).json({ msg: 'yooo' })
});

router.get('/getUserProfile', async (_, res) => {
  console.log('getUserProfile')
  try {
    const user = await userModel.findOne({ userId: res.locals.userId });
    res.status(200).json({ success: true, data: user, msg: '' });
  } catch (err) {
    res.status(400).json({ success: false, data: null, msg: 'Error getting user profile.' });
  }
});

router.post('/registerInfos', async (req, res) => {
  console.log('/registerInfos');
  const { firstName, lastName, profilePic } = req.body;
  try {
    if (!firstName || !lastName || !profilePic) {
      throw new Error('Incomplete infos.');
    }
    const user = await userModel.findOne({ userId: res.locals.userId });
    user.profilePic = profilePic;
    user.firstName = firstName;
    user.lastName = lastName;
    user.profileCompleted = true;
    await user.save();
    res.status(200).json({ success: true, data: {}, msg: '' });
  } catch (err) {
    console.log(err);
    res.status(400).json({ success: false, data: null, msg: 'Error registering user profile infos.' });
  }
});

router.get('/getDeck', async (_, res) => {
  try {
    const user = await userModel.findOne({ userId: res.locals.userId });
    if (!user) {
      throw new Error('Internal error.');
    }
    const excludedIds = [user.userId, ...user.likes, ...user.blocked, ...user.seen];
    const deck = await userModel.aggregate([
      { $match: { userId: { $nin: excludedIds } } },
      { $project: { _id: 0, profilePic: 1, firstName: 1, dob: 1, bio: 1, userId: 1 } }
    ]);
    //console.log(deck);
    res.status(200).json({ success: true, data: deck, msg: '' });
  } catch (err) {
    console.log(err);
    res.status(400).json({ success: false, data: null, msg: 'Error getting matches.' });
  }
});

router.put('/sendLike', async (req, res) => {
  console.log('/sendLike');
  const { userId } = req.body;
  try {
    await userModel.updateOne({ userId: res.locals.userId }, { $addToSet: { likes: userId } });
    res.send({ success: true, data: null, msg: '' });
  } catch (err) {
    console.log(err);
    res.status(400).json({ success: false, data: null, msg: 'Error liking somebody.' });
  }
});

router.put('/sendDislike', async (req, res) => {
  const { userId } = req.body;
  console.log('/sendLike');
  try {
    await userModel.updateOne({ _id: userId }, { $push: { likes: userId } });
  } catch (err) {
    console.log(err);
    res.status(400).json({ success: false, data: null, msg: 'Error liking somebody.' });
  }
});

router.put('/blockUser', async (req, res) => {
  console.log('/blockUser');
  const { userId } = req.body;
  try {
    await userModel.updateOne({ _id: userId }, { $push: { blocked: userId } });
  } catch (err) {
    res.status(400).json({ success: false, data: null, msg: 'Error blocking user.' });
  }
});

router.get('/getMatches', async (_, res) => {
  console.log('/getMatches');
  try {
    const userId = res.locals.userId;
    const user = await userModel.find({ userId: userId }); // TODO: filters depending on user preferences and geoloc
    const matches = await userModel.aggregate([
      { $match: { likes: userId, userId: { $ne: userId } } },
      { $project: { _id: 0, userId: 1, firstName: 1, bio: 1, profilePic: 1 } }
    ]);
    console.log(matches.length)
    res.status(200).json({ success: true, data: matches, msg: '' });
  } catch (err) {
    res.status(400).json({ success: false, data: null, msg: 'Error getting matches.' });
  }
});

router.get('/getMessages', async (req, res) => {
  console.log('/getMessages');
  const { userId } = res.locals;
  try {
    const messages = await messagesModel.find({ $or: [{ from: userId }, { to: userId }] });
    console.log(messages, userId);
    if (!messages) {
      res.status(200).json({ success: true, data: [], msg: '' });
    }
    res.status(200).json({ success: true, data: messages, msg: '' });
  } catch (err) {
    res.status(400).json({ success: false, data: null, msg: 'Error getting messages.' });
  }
});

router.post('/sendMessage', async (req, res) => {
  console.log('/sendMessage');
  console.log(req.body)
  const { userId } = res.locals;
  const { to, msg } = req.body;
  try {
    console.log(userId, to, msg, 'message sent');
    if (!to || !msg) throw new Error('Incomplete data.');
    const matches = await userModel.aggregate([
      { $match: { likes: userId, userId: { $ne: userId } } },
      { $project: { _id: 0, userId: 1 } }
    ]);
    console.log(matches);
    if (!matches.some(elem => elem.userId === to)) {
      throw new Error('Unknown destination.');
    }
    const from = userId;
    const newMessage = await new messagesModel({ from, to, msg });
    console.log(from, msg, to);
    console.log('newMessage=', newMessage)
    newMessage.save();
    ioNotifySend({ from: userId, msg, to });
    res.status(200).json({ success: true, data: null });
  } catch (err) {
    console.log(err.name, err.message, 'err');
    res.status(400).json({ success: false, data: null, msg: !err.name ? 'Error sending message.' : err });
  }
});

module.exports = router;