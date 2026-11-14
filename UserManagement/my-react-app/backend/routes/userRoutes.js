const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/authMiddleware");
const { requireAdmin, requireSelfOrAdmin } = require("../middleware/roleMiddleware");
const {
  getUsers,
  createUser,
  deleteUser,
  updateUser,
  getAddresses,
  addAddress,
  updateAddress,
  deleteAddress
} = require("../controllers/userController");

// User Address Book Routes (Self/Authenticated)
router.get("/addresses/me", verifyToken, getAddresses);
router.post("/addresses/me", verifyToken, addAddress);
router.put("/addresses/me/:addressId", verifyToken, updateAddress);
router.delete("/addresses/me/:addressId", verifyToken, deleteAddress);

router.get("/", verifyToken, requireAdmin, getUsers);
router.post("/", verifyToken, requireAdmin, createUser);
router.put("/:id", verifyToken, requireSelfOrAdmin, updateUser);
router.delete("/:id", verifyToken, requireAdmin, deleteUser);

module.exports = router;
