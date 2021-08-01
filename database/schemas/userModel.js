const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
	email: mongoose.Schema.Types.String,
	password: mongoose.Schema.Types.String,
	userId: mongoose.Schema.Types.String,
	profileCompleted: mongoose.Schema.Types.Boolean,
	firstName: mongoose.Schema.Types.String,
	lastName: mongoose.Schema.Types.String,
	gender: { type: mongoose.Schema.Types.String, enum: ['Male', 'Female'] },
	dob: mongoose.Schema.Types.Date,
	bio: mongoose.Schema.Types.String,
	profilePic: mongoose.Schema.Types.String,
	likes: mongoose.Schema.Types.Array,
	seen: mongoose.Schema.Types.Array,
	blocked: mongoose.Schema.Types.Array,
}, {
	timestamps: true,
});

module.exports = mongoose.model('user', userSchema);