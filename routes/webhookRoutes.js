const express = require('express');
const router = express.Router();
const { getDB } = require('../config/db');
const { ObjectId } = require('mongodb');

router.post('/', async(req, res) => {
    try {
        if(req.body.action == "parcel_status_changed" && req.body.parcel.status.id==1000) {   
            
            const ordersCollection = getDB().collection('orders');
        
            await ordersCollection.findOneAndUpdate(
                { _id: new ObjectId(req.body.parcel.order_number) }, // Find by _id
                { $set: { status: "completed" } }, // Update status
                { returnDocument: "after" } // Return updated document
              );
           }
        
           res.status(200).send("Webhook received");
    } catch (error) {
        console.log(error);
        res.status(200).send("Webhook received");
    }
  });

module.exports = router;
