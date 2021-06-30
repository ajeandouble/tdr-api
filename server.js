const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const cors = require("cors");
const mongoose = require("mongoose");
const firebase = require("firebase");
const firebaseAdmin = require("firebase-admin");

require("dotenv").config();
const keys = require("./config/keys");

const db = require("./config/keys").MongoURI;
console.log(db);
mongoose
  .connect(db, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log(`MongoDB connected...`))
  .catch((err) => console.log(err));

const usersModel = require('./database/schemas/usersModel');

app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: false })); // support encoded bodies

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

		const userExists = await usersModel.findOne({ email: email});
		if (userExists) {
			throw Error("User already exists.")
		}
		await usersModel.create({ email: email, password: password, userId: userId, profileCompleted: false });
	
		res.status(200).json({ success: true, message: "User successfully created.", data: { idToken } });
	} catch(err) {
		console.log(err)
		if (err.code === 'auth/email-already-in-use') {
			res.status(200).json({ success: false, message: "Email already in use", data: {} });
		}
		res.status(401).json({ error: err.code ? err.code : err })
	}
});

app.post('/login', async (req, res) => {
	const email = req.body.email;
	const password = req.body.password;

	let errors = {};

	try {
		const data = await firebase.auth().signInWithEmailAndPassword(email, password);
		const idToken = await data.user.getIdToken();
		const userId = data.user.uid;

		const user = await usersModel.findOne({ userId: userId });
		if (!user) {
			throw Error("Internal error");
		}
		res.status(201).json({ success: true, message: "", data: { idToken } });
	}
	catch (err) {
		console.log(err)
		if (err.code)
			switch (err.code) {
				case "auth/user-not-found":
					err = "User not found.";
					break;
				case "auth/wrong-password":
					err = "Wrong password";
					break;
			}
		res.status(401).json({ success: false, message : err, data: {} });
	}
});

async function firebaseAuth(req, res, next) {
	try {
		let idToken;
		console.log('firebaseAuth')
		console.log(req.headers, req.headers)
		if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
			idToken = req.headers.authorization.split('Bearer ')[1];
			console.log('firebaseAuth')
		} else {
			console.log('firebaseAuth err')
			throw Error("No token found");
		}
		console.log('firebase', idToken)
		const decodedToken = await firebaseAdmin.auth().verifyIdToken(idToken);
		console.log('firebase', idToken)
		if (!decodedToken) {
			throw Error("Can't decode token");
		}
		const userId = decodedToken.user_id;
		const user = await usersModel.findOne({ userId });
		if (!user) {
			throw Error("Can't find user");
		}
		res.locals.userId = userId;
		next();
	}
	catch (err) {
		res.status(403).json({ error: err });
	}
}

app.use("/api", firebaseAuth, require('./api.js'));

// To del
app.get("/", (req, res) => {
  res.send("/");
});

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () =>
  console.log(`Server listenning on port ${PORT}`)
);
