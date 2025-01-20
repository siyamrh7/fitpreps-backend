const express = require('express');
const router = express.Router();
const trackingController = require('../controllers/eventsTrackController');

router.post('/', trackingController.trackEventController);

module.exports = router;
