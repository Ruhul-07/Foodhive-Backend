const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const app = express();
const port = process.env.PORT || 5000;
const secret = process.env.JSON_WEB_TOKEN

app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

const verifyJWT = (req, res, next) => {
  const token = req.cookies.jwtToken;

  if (!token) {
    return res.status(401).send({ message: "Unauthorized access" });
  }

  const secret = process.env.JWT_SECRET || "your_secret_key";
  jwt.verify(token, secret, (err, decoded) => {
    if (err) {
      return res.status(403).send({ message: "Forbidden access" });
    }
    req.user = decoded;
    next();
  });
};


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.joj1d.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
    // Collection Name
    const foodsCollection = client.db("foodhive").collection("foods");
    const purchasesCollection = client.db("foodhive").collection("purchases");

    // auth jwt
    app.post("/jwt", (req, res) => {
      const user = req.body;
      const secret = process.env.JWT_SECRET || "your_secret_key";
      const token = jwt.sign(user, secret, { expiresIn: "1h" });

      // Set the token as an HTTP-only cookie
      res
        .cookie("jwtToken", token, {
          httpOnly: true, // Prevents client-side access
          secure: process.env.NODE_ENV === "production", // Only send over HTTPS in production
          maxAge: 3600000, // 1 hour
        })
        .send({ message: "JWT token issued" });
    });

    app.get("/topFoods", async (req, res) => {
      try {
        const topFoods = await foodsCollection
          .find()
          .sort({ purchaseCount: -1 }) // Sort by purchase count in descending order
          .limit(8) // Limit to top 6 items
          .toArray();
        res.status(200).send(topFoods);
      } catch (error) {
        res.status(500).send({ message: "Error fetching top foods", error });
      }
    });

    // Get all foods APIs
    app.get("/foods", async (req, res) => {
      const cursor = foodsCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });
    // log out jwt
    app.post("/logout", (req, res) => {
      res
        .clearCookie("jwtToken", {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
        })
        .send({ message: "Logged out successfully" });
    });
    // Get a single food item by ID
    app.get("/foods/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await foodsCollection.findOne(query);
      res.send(result);
    });

    // add food item
    app.post("/addFood", async (req, res) => {
      console.log(req.body);
      const {
        name,
        category,
        image,
        price,
        quantity,
        description,
        shortDescription,
        purchaseCount,
        foodOrigin,
        addedBy,
      } = req.body;
      const newFood = {
        name,
        category,
        image,
        price: parseFloat(price),
        quantity: parseInt(quantity, 10),
        description,
        shortDescription,
        purchaseCount: purchaseCount || 0,
        foodOrigin,
        addedBy: {
          name: addedBy.name,
          email: addedBy.email,
        },
      };
      const result = await foodsCollection.insertOne(newFood);
      console.log("Insert result:", result);
      res.send(result);
    });

    // my foods api
    app.get("/myFoods",  verifyJWT, async (req, res) => {
      const email = req.query.email;
      const query = { "addedBy.email": email };
      const result = await foodsCollection.find(query).toArray();
      res.send(result);
    });

    // update food
    app.put("/updateFood/:id", async (req, res) => {
      const { id } = req.params;
      const updatedData = req.body;
      if (updatedData._id) {
        delete updatedData._id;
      }
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: updatedData,
      };
      const result = await foodsCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    // Purchase a food item with update purchaseCount
    app.post("/purchaseFood", async (req, res) => {
      const {
        foodId,
        foodName,
        buyerName,
        buyerEmail,
        quantity,
        price,
        buyingDate,
        foodImg,
      } = req.body;
      const purchase = {
        foodId: new ObjectId(foodId),
        foodName,
        buyerName,
        buyerEmail,
        quantity,
        price,
        buyingDate,
        foodImg,
      };
      const result = await purchasesCollection.insertOne(purchase);
      // update purchaseCount
      const updateResult = await foodsCollection.updateOne(
        { _id: new ObjectId(foodId) },
        { $inc: { purchaseCount: 1 } }
      );
      if (result.acknowledged && updateResult.modifiedCount > 0) {
        res.status(200).send({ message: "Purchase successful" });
      } else {
        res.status(500).send({ message: "Error occurred during purchase" });
      }
    });

    // Get order by user
    app.get("/myOrders/:email", async (req, res) => {
      const email = req.params.email;
      const query = { buyerEmail: email };
      const orders = await purchasesCollection.find(query).toArray();
      res.send(orders);
    });

    // Delete a specific order
    app.delete("/deleteOrder/:orderId", async (req, res) => {
      const { orderId } = req.params;
      const query = { _id: new ObjectId(orderId) };
      const result = await purchasesCollection.deleteOne(query);
      res.send(result);
    });
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("This is FoodHive server");
});

app.listen(port, () => {
  console.log(`FoodHive server is running at : ${port}`);
});
