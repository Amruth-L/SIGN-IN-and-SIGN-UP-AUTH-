const router = require('express').Router();
const auth = require('../middleware/authMiddleware');
const controller = require('../controllers/campusController');
router.use(auth);
router.get('/', controller.getCampus);
router.get('/locations', controller.getLocations);
router.get('/route', controller.getRoute);
module.exports = router;
