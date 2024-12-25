const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

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

    // Get all foods APIs
    app.get("/foods", async (req, res) => {
      const cursor = foodsCollection.find();
      const result = await cursor.toArray();
      res.send(result);
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
      console.log(req.body)
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
    app.get('/myFoods', async(req, res) => {
      const email = req.query.email;
      const query = {"addedBy.email": email};
      const result = await foodsCollection.find(query).toArray();
      res.send(result)
    })

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
