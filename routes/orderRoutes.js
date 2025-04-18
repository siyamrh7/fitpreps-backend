// routes/orderRoutes.js
const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const authenticateJWT = require('../middleware/authMiddleware');
const authenticateAdmin = require('../middleware/authAdminMiddleware');
router.post('/create', orderController.createOrder);
router.get('/checkpayment/:transactionId', orderController.checkPayment);
router.delete('/orders',authenticateAdmin, orderController.deleteOrders);
router.put('/status',authenticateAdmin, orderController.updateOrderStatus);
router.put('/packingstatus',authenticateAdmin, orderController.updatePackingSlipStatus);

router.get('/',authenticateAdmin,  orderController.getAllOrders);
router.get('/order/:id',authenticateAdmin,  orderController.getOrderById);

router.get('/order', authenticateJWT, orderController.getOrder);
router.get('/analytics',authenticateAdmin,  orderController.getAnalytics);
router.get('/getshipping', orderController.getShippingMethods);
// router.get('/payment/:id', orderController.getPaynlStatus);

const BASE_URL = 'http://addressapi.nl/wp-json/postcode-information/v1/info';

// Proxy route
router.get('/address-info', async (req, res) => {
    const { postcode, house_number, addition, website } = req.query;

    // Construct the target URL with query parameters
    const params = new URLSearchParams();
    if (postcode) params.append('postcode', postcode);
    if (house_number) params.append('house_number', house_number);
    if (addition) params.append('addition', addition);
    if (website) params.append('website', website);

    try {
        const response = await fetch(`${BASE_URL}?${params.toString()}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        res.status(response.status).json(data); // Send back the API response
    } catch (error) {
        console.error('Error fetching data from Address API:', error.message);
        res.status(error.response?.status || 500).json({
            error: error.message || 'An unknown error occurred.',
        });
    }
});

// router.get('/paynl', async (req, res) => {
//     console.log(req.query)
//     var paynl = req.query.object
//     const response = await fetch(`/api/orders/checkpayment/${paynl.orderId}`, {
//         method: "GET",
//         headers: {
//           "Content-Type": "application/json",
//         }
//       });

//       const data = await response.json();
//       console.log(data)
//     res.status(200).send("OK")
// });
router.get('/paynl', async (req, res) => {
    try {
        const paynl = req.query.object;

        if (!paynl || !paynl.orderId) {
            return res.status(400).json({ error: "Missing orderId in request" });
        }
            req.url = `/api/orders/checkpayment/${paynl.orderId}`;
            req.method = "GET";
            
            req.app.handle(req, res)
     
        // Calling another internal API without fetch (faster, no network overhead)
       
    } catch (error) {
        console.error("Error processing Pay.nl request:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

module.exports = router;
