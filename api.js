const router = require('express').Router();

const usersModel = require('./database/schemas/usersModel.js');

router.use('/test', async (req, res) => {
    console.log('userId', res.locals.userId);
    const test = await usersModel.findOne({ userId: res.locals.userId });
    console.log(test);

    res.status(200).json({msg: 'yooo'})
});

router.get('/getUserProfile', async (req, res) => {
    console.log('getUserProfile')
    try {
        const user = await usersModel.findOne({ userId: res.locals.userId });
        res.status(200).json({ success: true, data: { user: user}, msg : '' });
    } catch (err) {
        res.status(400).json({ success: false, data: null, msg : 'Error getting user profile.' });
    }
});

module.exports = router;