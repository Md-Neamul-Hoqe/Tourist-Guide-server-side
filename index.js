require('dotenv').config()
const express = require('express');
const cors = require('cors');
const jsonwebtoken = require('jsonwebtoken');
const cookieParser = require('cookie-parser');

const stripe = require("stripe")(process.env.Payment_SECRET);

/* All require statements must in top portion to access desired components / functions */

const bistroBoss = "bistroBossDB";
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000;
// console.log('Secret: ', process.env.Payment_SECRET);

const app = express();


app.use(cors({
    origin: [ "http://localhost:5173", "https://bistro-boss-mnh.web.app" ],
    credentials: true
}));
app.use(express.static("public"));
app.use(express.json());
app.use(cookieParser());

const uri = `mongodb+srv://${process.env.milestone12_USER}:${process.env.milestone12_PASS}@projects.mqfabmq.mongodb.net/${bistroBoss}?retryWrites=true&w=majority`;


// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        const db = client.db(bistroBoss);
        const menuCollection = db.collection('menu');
        const reviewCollection = db.collection('reviews');
        const userCollection = db.collection('users');
        const cartCollection = db.collection('carts');
        const paymentCollection = db.collection('payments');



    } catch (error) {
        console.log(error);
    }
}
run().catch(console.dir);





app.get('/', (_req, res) => {
    res.send('Bistro Boss App is running');
})

app.listen(port, () => {
    console.log(`Bistro server is running on ${port}`);
})