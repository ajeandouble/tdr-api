const mongoose = require("mongoose");

const messagesSchema = new mongoose.Schema({
	from: mongoose.Schema.Types.String,
	to: mongoose.Schema.Types.String,
	msg: {
		type: mongoose.Schema.Types.String,
		minLength: 1,
		maxLength: 256,
	}
}, {
	timestamps: true,
});

module.exports = mongoose.model('messages', messagesSchema);