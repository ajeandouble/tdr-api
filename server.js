const express = require("express");
const asyncify = require('express-asyncify');
const app = asyncify(express());
const cors = require("cors");
const mongoose = require("mongoose");
const firebase = require("firebase");
const firebaseAdmin = require("firebase-admin");

const server = require('http').Server(app);
const io = require('socket.io')(server);
app.use(express.json({ limit: '2mb'}));

require("dotenv").config();
const keys = require("./config/keys");

const db = require("./config/keys").MongoURI;

mongoose
  .connect(db, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log(`MongoDB connected...`))
  .catch((err) => console.log(err));

const userModel = require('./database/schemas/userModel');

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: "ajeandouble-tdr.firebaseapp.com",
  projectId: "ajeandouble-tdr",
  storageBucket: "ajeandouble-tdr.appspot.com",
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
  measurementId: process.env.FIREBASE_MEASUREMENT_ID,
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

firebaseAdmin.initializeApp();

if (process.env.NODE_ENV === "develop") {
  app.enable("trust proxy");
} else {
  app.set("trust proxy", 1); // For Heroku?

  console.log("NODE_ENV=", process.env.NODE_ENV);
}

// CORS
app.use(cors());

app.post("/signup", async (req, res) => {
	const email = req.body.email;
	const password = req.body.password;

	try {
		const userCredentials = await firebase.auth().createUserWithEmailAndPassword(email,password)
		const idToken = await userCredentials.user.getIdToken();
		const userId = userCredentials.user.uid;

		const userExists = await userModel.findOne({ email: email});
		if (userExists) {
			throw Error("User already exists.")
		}
		await userModel.create({ email: email, password: password, userId: userId, profileCompleted: false }); // TODO: use _id instead of userId
	
		res.status(200).json({ success: true, message: "User successfully created.", data: { idToken } });
	} catch(err) {
		console.log(err)
		if (err.code === 'auth/email-already-in-use') {
			res.status(200).json({ success: false, message: "Email already in use", data: {} });
		}
		res.status(401).json({ error: err.code ? err.code : err })
	}
});

app.post('/login', async (req, res, next) => {
	console.log('/login')
	const email = req.body.email;
	const password = req.body.password;

	if (!email.length)
		return res.status(401).json({ success: false, message : 'Empty email field.', data: {} });
	if (!password.length)
		return res.status(401).json({ success: false, message : 'Empty password field.', data: {} });

	const auth = await firebase.auth();
	auth.signInWithEmailAndPassword(email, password)
		.catch(err => {
			if (err.code) {
				switch (err.code) {
					case 'auth/user-not-found':
						err = 'User not found.';
						break;
					case 'auth/wrong-password':
						err = 'Wrong password.';
						break;
					case 'auth/invalid-email':
						err = 'Invalid email';
						break;
				}
			}
			else if (err.toString) {
				err.name = '';
				err = err.toString();
			}
			return res.status(401).json({ success: false, message : err, data: {} });
		})
		.then(data => {
			if (!data || !data.user || !data.user.uid) {
				res.status(401).json({ success: false, message: 'Can\'t find user.'});
				throw new Error('Can\'t find user.');
			}
			const userId = data.user.uid;

			console.log('userId=', userId)
			
			return Promise.all([data.user.getIdToken(), userModel.findOne({ userId: userId })]);
		})
		.catch(err => {
			console.log(err)
			return res.status(401).json({ success: false, message: 'Can\'t generate token.'});
			// TODO: multiple errors
		})
		.then(values => {
			const [idToken, user] = values;
			if (!user) {
				throw new Error('User doesn\t exist');
			}
			return Promise.all([Promise.resolve(idToken), firebaseAdmin.auth().createCustomToken(user.userId)]);
		})
		.then(values => {
			const [idToken, customToken] = values;
			console.log(idToken, customToken);
			return res.status(201).json({ success: true, message: "", data: { idToken, customToken } });
		})
		.catch (err => {
			return res.status(401).json({ success: false, message: err?.code });
		})
		
});

async function firebaseAuth(req, res, next) {
	try {
		console.log(firebaseAuth.name);
		let idToken;
		if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
			idToken = req.headers.authorization.split('Bearer ')[1];
		} else {
			throw Error("No token found");
		}
		const decodedToken = await firebaseAdmin.auth().verifyIdToken(idToken);
		if (!decodedToken) {
			throw Error("Can't decode token");
		}
		const userId = decodedToken.user_id;
		const user = await userModel.findOne({ userId });
		if (!user) {
			throw Error("Can't find user");
		}
		res.locals.userId = userId;
		next();
	}
	catch (err) {
		console.log(err);
		res.status(403).json({ error: err });
	}
}

app.use("/api", firebaseAuth, require('./api.js'));

// To del
app.get("/", (req, res) => {
  res.send("Hello.");
});


app.get('*', function(req, res){
	res.status(404).json({success: false, msg: 'Route not found.', data: {} });
});

require('./socket-server/socket-server.js').io(io, firebaseAdmin);

const PORT = process.env.PORT || 5000;

server.listen(PORT, () =>
  console.log(`Server listenning on port ${PORT}`)
);
