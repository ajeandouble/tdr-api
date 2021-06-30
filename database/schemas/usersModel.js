const mongoose = require("mongoose");

const usersSchema = new mongoose.Schema({
	email: mongoose.Schema.Types.String,
	password: mongoose.Schema.Types.String,
	userId: mongoose.Schema.Types.String,
}, {
	timestamps: true,
});

module.exports = mongoose.model('users', usersSchema);