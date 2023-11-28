require('dotenv').config()
const express = require('express');
const cors = require('cors');
const jsonwebtoken = require('jsonwebtoken');
const cookieParser = require('cookie-parser');

// const stripe = require("stripe")(process.env.Payment_SECRET);

/* All require statements must in top portion to access desired components / functions */

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000;
// console.log('Secret: ', process.env.Payment_SECRET);

const app = express();


app.use(cors({
    origin: [ "http://localhost:5173", "https://tourist-guides-mnh.web.app" ],
    credentials: true
}));
app.use(express.static("public"));
app.use(express.json());
app.use(cookieParser());


// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(process.env.URI, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        const db = client.db(process.env.DB_NAME);
        const storyCollection = db.collection('stories');
        const packageCollection = db.collection('packages');
        const userCollection = db.collection('users');
        const wishListCollection = db.collection('wishLists');
        const reviewCollection = db.collection('reviews');

        const cartCollection = db.collection('carts');
        const planeCollection = db.collection('planes');
        // const paymentCollection = db.collection('payments');


        /* Auth APIs */

        /* Middleware JWT implementation */
        const verifyToken = async (req, res, next) => {
            try {
                // console.log('the token to be verified: ', req?.cookies);
                const token = req?.cookies?.[ "dream-place-token" ];


                if (!token) return res.status(401).send({ message: 'Unauthorized access' })

                jsonwebtoken.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
                    // console.log(err);
                    if (err) {
                        // console.log(err);
                        return res.status(401).send({ message: 'You are not authorized' })
                    }

                    // console.log(decoded);
                    req.user = decoded;
                    next();
                })
            } catch (error) {
                // console.log(error);
                res.status(500).send({ message: error?.message || error?.errorText });
            }
        }

        /* verify admin after verify token */
        const verifyGuide = async (req, res, next) => {
            // const { email } = req?.params;
            // const token = req?.cookies[ 'dream-place-token' ];
            const { email } = req?.user;
            console.log(email);
            const query = { "contactDetails.email":email }

            const theUser = await userCollection.findOne(query)
            console.log('isGuide : ', theUser);

            const isGuide = theUser?.role === 'guide'
            if (!isGuide) res.status(403).send({ message: 'Access Forbidden' })

            next();
        }
        
        const verifyAdmin = async (req, res, next) => {
            // const { email } = req?.params;
            // const token = req?.cookies[ 'dream-place-token' ];
            const { email } = req?.user;
            // console.log(email);
            const query = { "contactDetails.email":email }

            const theUser = await userCollection.findOne(query)
            //console.log('isAdmin : ', theUser);

            const isAdmin = theUser?.role === 'admin'
            if (!isAdmin) res.status(403).send({ message: 'Access Forbidden' })

            next();
        }

        // console.log(process.env);
        const setTokenCookie = async (req, res, next) => {
            const user = req?.body;

            // console.log(user);

            if (user?.email) {
                const token = jsonwebtoken.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '24h' })

                // console.log('Token generated: ', token);
                res
                    .cookie('dream-place-token', token, {
                        httpOnly: true,
                        secure: process.env.NODE_ENV === 'production',
                        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
                    })
                req[ "dream-place-token" ] = token;

                // console.log('Token Created: ', req[ "dream-place-token" ]);
                next();
            }
        }

        /* Create JWT */
        app.post('/api/v1/auth/jwt', setTokenCookie, (req, res) => {
            try {
                const token = req[ "dream-place-token" ];

                // console.log('token in cookie: ', token);

                if (!token) return res.status(400).send({ success: false, message: 'Unknown error occurred' })

                console.log('User sign in successfully.');
                res.send({ success: true })
            } catch (error) {
                res.send({ error: true, message: error.message })
            }

        })

        /* clear cookie / token of logout user */
        app.post('/api/v1/user/logout', (_req, res) => {
            try {
                res.clearCookie('dream-place-token', { maxAge: 0 }).send({ success: true })
            } catch (error) {
                res.status(500).send({ error: true, message: error.message })
            }
        })

        /**
         * ============================================
         * Users APIs
         * ============================================
         */
        /* Create user */
        app.post('/api/v1/users', async (req, res) => {
            try {
                const user = req.body;

                const query = { "contactDetails.email": user?.contactDetails?.email }
                const existingUser = await userCollection.findOne(query);

                console.log('is Existing User: ', existingUser);

                if (existingUser)
                    return res.send({ message: `Welcome back ${existingUser?.name}${existingUser?.role ? ' as ' + existingUser?.role : 'user.'}`, insertedId: null })


                const result = await userCollection.insertOne(user)
                res.send(result)
            } catch (error) {
                res.status(500).send({ error: true, message: error.message })
            }
        })

        /* get the user with ID */
        app.get('/api/v1/users/:id', async (req, res) => {
            try {
                const { id } = req?.params;
                const query = { _id: new ObjectId(id) }

                // console.log('User info: ', query);

                const result = await userCollection.findOne(query);

                console.log('User with a id: ', result);
                res.send(result)
            } catch (error) {
                res.status(500).send({ error: true, message: error.message })
            }
        })

        /* get the user by email */
        app.get('/api/v1/current-user/:email', async (req, res) => {
            try {
                const { email } = req?.params;
                const query = { "contactDetails.email": email }
                const result = await userCollection.findOne(query);

                // console.log(query, result);
                res.send(result)
            } catch (error) {
                res.status(500).send({ error: true, message: error.message })
            }
        })

        /* update the user of ID */
        app.put('/api/v1/update-user/:id', verifyToken, verifyAdmin, async (req, res) => {
            try {
                const { id } = req?.params;
                const query = { _id: new ObjectId(id) }
                const user = req.body;
                const updatedUser = {
                    $set: {
                        ...user
                    }
                }

                console.log('Will Update user: ', updatedUser);
                const result = await userCollection.updateOne(query, updatedUser);
                res.send(result)
            } catch (error) {
                res.status(500).send({ error: true, message: error.message })
            }
        })

        /* Get all users [admin] */
        app.get('/api/v1/users', verifyToken, verifyAdmin, async (_req, res) => {
            const result = await userCollection.find().toArray();
            res.send(result)
        })

        /* Get all users of a role */
        app.get('/api/v1/role-users/:role', async (req, res) => {
            const { role } = req.params;

            const query = {}

            if (role) query.role = role;

            // console.log(query);

            const result = await userCollection.find(query).toArray();
            return res.send(result)


            // res.status(403).send({ message: 'Forbidden access' })
        })

        /* delete user [admin] */
        app.delete('/api/v1/users/:id', verifyToken, verifyAdmin, async (req, res) => {
            try {
                const { id } = req.params;
                const query = { _id: new ObjectId(id) }

                console.log('delete user: ', query);

                const result = await userCollection.deleteOne(query)

                res.send(result)
            } catch (error) {
                console.log(error);
                res.status(500).send({ message: error?.message })
            }
        })

        /* add admin [admin] */
        // app.patch('/api/v1/users/admin/:id', verifyToken, async (req, res) => {
        //     try {
        //         const { id } = req.params;

        //         const query = { _id: new ObjectId(id) }

        //         const updatedUser = {
        //             $set: {
        //                 role: 'admin'
        //             }
        //         }

        //         const result = await userCollection.updateOne(query, updatedUser)

        //         return res.send(result)
        //     } catch (error) {
        //         console.log(error);
        //         res.status(500).send({ message: error?.message })
        //     }
        // })

        /* get current user's role */
        app.get('/api/v1/user/authorization/:email', async (req, res) => {
            try {
                const { email } = req.params;

                // if (email !== req?.user?.email) return res.status(403).send({ message: 'Access Forbidden' });

                const query = { "contactDetails.email": email }
                const result = await userCollection.findOne(query);
                // console.log('Authentic User: ', result);

                const admin = result?.role

                res.send({ admin })
            } catch (error) {
                console.log(error);
                res.status(500).send({ message: error?.message })
            }
        })

        /**
         * ================================================================
         * Story APIs
         * ================================================================
         */
        /* insert user story */
        app.post('/api/v1/user/create-story', verifyToken, async (req, res) => {
            try {
                const story = req.body

                const result = await storyCollection.insertOne(story);

                // console.log(result);

                res.send(result)

            } catch (error) {
                console.log(error);
                res.status(500).send({ message: error?.message })
            }
        })

        /* get all users stories */
        app.get('/api/v1/user/stories', async (req, res) => {
            try {
                const LimitThree = parseInt(req.query?.max) || 0;

                const result = await storyCollection.find().limit(LimitThree).toArray();

                // console.log(result);
                res.send(result)
            } catch (error) {
                console.log(error);
                res.status(500).send({ message: error?.message })
            }
        })

        /* get a story */
        app.get('/api/v1/user/stories/:id', async (req, res) => {
            try {
                const { id } = req.params;

                const result = await storyCollection.findOne({ _id: new ObjectId(id) });

                // console.log(result);
                res.send(result)
            } catch (error) {
                console.log(error);
                res.status(500).send({ message: error?.message })
            }
        })

        /**
         * ================================================================
         * Package APIs
         * ================================================================
         */

        /* add package */
        app.post('/api/v1/add-packages', verifyToken, verifyAdmin, async (req, res) => {
            try {
                const item = req.body;

                // console.log('package will be added: ', item);

                const result = await packageCollection.insertOne(item);


                res.send(result)

            } catch (error) {
                console.log(error);
                res.status(500).send({ message: error?.message })
            }
        })

        /* get a package by ID */
        app.get('/api/v1/details-packages/:id', async (req, res) => {
            try {
                const { id } = req.params;
                const query = { _id: new ObjectId(id) }

                const result = await packageCollection.findOne(query);
                // console.log(id, ' package ', result);

                res.send(result)

            } catch (error) {
                console.log(error);
                res.status(500).send({ message: error?.message })
            }
        })

        /* get all packages */
        app.get('/api/v1/packages', async (req, res) => {
            try {
                const max = parseInt(req.query?.max) || 0;

                const result = await packageCollection.find().limit(max).toArray();

                // console.log('All packages: ', result);

                res.send(result)

            } catch (error) {
                console.log(error);
                res.status(500).send({ message: error?.message })
            }
        })

        /* get packages by Type */
        app.get('/api/v1/typed-packages/:type', async (req, res) => {
            try {
                const { type } = req.params;
                const query = { type }

                const result = await packageCollection.find(query).toArray();

                // console.log(type, 'packages: ', result);

                res.send(result)

            } catch (error) {
                console.log(error);
                res.status(500).send({ message: error?.message })
            }
        })

        /* Get all types of the packages */
        app.get('/api/v1/packages/types', async (_req, res) => {
            try {
                const result = await packageCollection.aggregate([
                    {
                        $group: {
                            _id: "$type",
                            thumbnail: { $first: "$thumbnail" }
                        }
                    },
                    {
                        $group: {
                            _id: null,
                            packages: {
                                $addToSet: {
                                    type: '$_id',
                                    thumbnail: '$thumbnail'
                                }
                            }
                        }
                    },
                    {
                        $project: {
                            _id: 0,
                            packages: 1
                        }
                    }

                ]).toArray();

                res.send(...result)

            } catch (error) {
                console.log(error);
                res.status(500).send({ message: error?.message })
            }
        })

        /* update a package by ID */
        app.put('/api/v1/update-packages/:id', verifyToken, verifyAdmin, async (req, res) => {
            try {
                const { id } = req.params;
                const query = { _id: new ObjectId(id) }
                const thePackage = req.body;
                const updatedPackage = {
                    $set: {
                        ...thePackage
                    }
                }

                const result = await packageCollection.updateOne(query, updatedPackage, { upsert: true });

                console.log('Package updated: ', result);

                res.send(result)

            } catch (error) {
                console.log(error);
                res.status(500).send({ message: error?.message })
            }
        })

        /* Delete a package */
        app.delete('/api/v1/delete-packages/:id', verifyToken, verifyAdmin, async (req, res) => {
            try {
                const { id } = req.params;

                console.log(id, ' package will be deleted.');
                const result = await packageCollection.deleteOne({ _id: new ObjectId(id) })

                // console.log(result);

                res.send(result)
            } catch (error) {
                console.log(error);
                res.status(500).send({ message: error?.message })
            }
        })


        /**
         * =========================================================================
         * Wish List APIs
         * =========================================================================
         */

        /* Add to wish list */
        app.post('/api/v1/wish-list/add-packages', verifyToken, async (req, res) => {
            try {
                /* package_id, user email */
                const wishPackage = req.body;

                const result = await wishListCollection.insertOne(wishPackage)

                res.send('Added to wish list: ', result)
            } catch (error) {
                console.log(error);
                res.status(500).send({ message: error?.message })
            }
        })

        /* Get the packages in wish list for the user email */
        app.get('/api/v1/wish-list/:email', verifyToken, async (req, res) => {
            try {
                const { email } = req.params;
                const wishList = await wishListCollection.find({ email }).toArray();

                const packageIds = wishList.map(wish => new ObjectId(wish?.package_id))

                const result = await packageCollection.find({ _id: { $in: packageIds } }).toArray();

                console.log('User Wishlist: ', packageIds);

                res.send(result)
            } catch (error) {
                console.log(error);
                res.status(500).send({ message: error?.message })
            }
        })

        /* Get a package as wish list from packageCollection */
        app.get('/api/v1/wish-list/package/:id', verifyToken, async (req, res) => {
            try {
                const { id } = req.params;

                const result = await packageCollection.findOne({ _id: new ObjectId(id) })

                // console.log(result);

                res.send(result)
            } catch (error) {
                console.log(error);
                res.status(500).send({ message: error?.message })
            }
        })

        /* Remove a package from wishList */
        app.delete('/api/v1/wish-list/delete-package/:id', verifyToken, async (req, res) => {
            try {
                const { id } = req.params;

                const result = await wishListCollection.deleteOne({ package_id: id })

                console.log('Removed from wishList: ', result);

                res.send(result)
            } catch (error) {
                console.log(error);
                res.status(500).send({ message: error?.message })
            }
        })

        /**
        * ================================================================
        * REVIEW APIs
        * ================================================================
        */

        /* insert a review */
        app.post('/api/v1/create-reviews', verifyToken, async (req, res) => {
            try {
                const review = req.body;

                const result = await reviewCollection.insertOne(review);
                // console.log(result);
                res.send(result)
            } catch (error) {

            }
        })

        /* get all review of a guide */
        app.get('/api/v1/reviews/:id', verifyToken, async (req, res) => {
            try {
                const query = { guide_id: req.params?.id }

                const result = await reviewCollection.find(query).toArray();
                // console.log(result);
                res.send(result)
            } catch (error) {

            }
        })

        /* Payment APIs */
        // app.post("/api/v1/create-payment-intent", async (req, res) => {
        //     const { price } = req.body;
        //     // Create a PaymentIntent with the order amount and currency
        //     // console.log(parseInt(price * 100));

        //     const paymentIntent = await stripe.paymentIntents.create({
        //         amount: parseInt(price * 100),
        //         currency: "usd",
        //         payment_method_types: [ 'card' ],
        //     });

        //     res.send({
        //         clientSecret: paymentIntent.client_secret,
        //     });
        // });

        // app.get('/api/v1/payments/:email', verifyToken, async (req, res) => {

        //     const query = { email: req?.params?.email }

        //     // console.log(req?.params?.email, req?.user?.email);

        //     if (req?.params?.email !== req?.user?.email) return res.status(403).send({ message: 'Forbidden access' })

        //     const paymentResult = await paymentCollection.find(query).toArray();

        //     // console.log(paymentResult);

        //     res.send(paymentResult)
        // })

        // app.post('/api/v1/payments', async (req, res) => {
        //     const payment = req.body;
        //     console.log(payment);

        //     const paymentResult = await paymentCollection.insertOne(payment);

        //     console.log(paymentResult);

        //     const query = {
        //         _id: {
        //             $in: payment.cartIds.map(id => new ObjectId(id))
        //         }
        //     }

        //     const deleteResult = await cartCollection.deleteMany(query)

        //     res.send({ paymentResult, deleteResult })
        // })

        // /* aggregate pipeline */
        // app.get('/api/v1/order-stats', verifyToken, verifyAdmin, async (_req, res) => {
        //     // app.get('/api/v1/order-stat', async (_req, res) => {
        //     const result = await paymentCollection.aggregate([
        //         { $unwind: '$menuItemIds' },
        //         { "$project": { "menuItemId": { "$toObjectId": "$menuItemIds" } } },
        //         {
        //             $lookup: {
        //                 from: 'menu',
        //                 localField: 'menuItemId',
        //                 foreignField: '_id',
        //                 as: 'menuItems',
        //             }
        //         },
        //         { $unwind: '$menuItems' },
        //         {
        //             $group: {
        //                 _id: '$menuItems.category',
        //                 quantity: { $sum: 1 },
        //                 revenue: { $sum: '$menuItems.price' }
        //             }
        //         },
        //         /* to rename _id key [_id to category] */
        //         {
        //             $project: {
        //                 _id: 0,
        //                 category: '$_id',
        //                 quantity: '$quantity',
        //                 revenue: '$revenue'
        //             }
        //         }

        //     ]).toArray();

        //     console.log(result[ 0 ]);

        //     res.send(result)
        // })

        // app.get('/api/v1/admin-stats', verifyToken, verifyAdmin, async (_req, res) => {
        //     try {
        //         const users = await userCollection.estimatedDocumentCount();
        //         const menuItems = await menuCollection.estimatedDocumentCount();
        //         const orders = await paymentCollection.estimatedDocumentCount();

        //         const aggregateResult = await paymentCollection.aggregate([
        //             {
        //                 $group: {
        //                     _id: null,
        //                     totalRevenue: {
        //                         $sum: '$price'
        //                     }
        //                 }
        //             }
        //         ]).toArray();

        //         const revenue = aggregateResult?.length > 0 ? aggregateResult[ 0 ].totalRevenue : 0

        //         console.log({
        //             users, menuItems, orders, revenue
        //         });

        //         res.send({
        //             users, menuItems, orders, revenue
        //         })
        //     } catch (error) {
        //         console.log(error);
        //         res.status(500).send({ message: error?.message })
        //     }
        // })

        /**
        * ================================================================
        * BOOKING APIs
        * ================================================================
        */
        app.post('/api/v1/create-booking', verifyToken, async (req, res) => {
            try {
                const carItem = req.body;

                const result = await cartCollection.insertOne(carItem)

                console.log('Booked package: ', result);
                res.send(result)
            } catch (error) {
                console.log(error);
                res.status(500).send({ message: error?.message })
            }
        })

        /* Booking cancel */
        app.delete('/api/v1/cancel-bookings/:id', verifyToken, async (req, res) => {
            try {
                const { id } = req.params;
                const email = req.query?.email

                const result = await cartCollection.deleteOne({ _id: new ObjectId(id) })

                // console.log(result);

                res.send(result)
            } catch (error) {
                console.log(error);
                res.status(500).send({ message: error?.message })
            }
        })

        /* Get package booking status */
        app.get('/api/v1/isBooked/:id', verifyToken, async (req, res) => {
            try {
                const { email } = req.query
                const { id } = req.params
                const query = { package_id: id, 'touristInfo.email': email }
                const result = await cartCollection.findOne(query);
                const countBookings = (await cartCollection.find().toArray()).length;
                let isBooked = { isBooked: false, bookingId: null, countBookings };

                // console.log(result);
                if (result) isBooked = { isBooked: true, bookingId: result?._id };

                res.send(isBooked)
            } catch (error) {
                console.log(error);
                res.status(500).send({ message: error?.message })
            }
        })

        /* Get all user bookings */
        app.get('/api/v1/bookings', verifyToken, async (req, res) => {
            try {
                const { email } = req.query
                const query = { 'touristInfo.email': email }
                const result = await cartCollection.find(query).toArray();
                res.send(result)
            } catch (error) {
                console.log(error);
                res.status(500).send({ message: error?.message })
            }
        })

        /* Get guide's all trips  */
        app.get('/api/v1/guide-trips/:id', verifyToken, verifyGuide, async (req, res) => {
            try {
                const { id } = req.params
                const query = { "guideInfo._id": id }
                const result = await cartCollection.find(query).toArray();

                // console.log('Guide Trips Reserved: ', result);
                res.send(result)
            } catch (error) {
                console.log(error);
                res.status(500).send({ message: error?.message })
            }
        })

        /* update guide's trip's status  */
        app.patch('/api/v1/update-trips/:id', verifyToken, verifyGuide, async (req, res) => {
            try {
                const { id } = req.params
                const trip = req.body
                const query = { _id: new ObjectId(id) }

                const updatedTrip = {
                    $set: {
                        ...trip
                    }
                }
                const result = await cartCollection.updateOne(query, updatedTrip);

                // console.log('Updated Trip: ', updatedTrip, result);
                res.send(result)
            } catch (error) {
                console.log(error);
                res.status(500).send({ message: error?.message })
            }
        })

        /**
         * ================================================================
         * TOUR PLANE APIs
         * ================================================================
        */

        app.get('/api/v1/tour-plane/:type', async (req, res) => {
            try {
                const { type } = req.params
                const query = { type }
                const result = await planeCollection.findOne(query)

                console.log('tour plane: ', result);
                res.send(result)
            } catch (error) {
                console.log(error);
                res.status(500).send({ message: error?.message })
            }
        })

    } catch (error) {
        console.log(error);
    }
}
run().catch(console.dir);





app.get('/', (_req, res) => {
    res.send('Dream Place App is running');
})

app.listen(port, () => {
    console.log(`Dream Place server is running on ${port}`);
})