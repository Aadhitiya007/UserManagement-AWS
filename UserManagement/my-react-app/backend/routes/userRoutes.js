const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/authMiddleware");
const { requireAdmin, requireSelfOrAdmin } = require("../middleware/roleMiddleware");
const { getUsers, createUser, deleteUser, updateUser } = require("../controllers/userController");

router.get("/", verifyToken, requireAdmin, getUsers);
router.post("/", verifyToken, requireAdmin, createUser);
router.put("/:id", verifyToken, requireSelfOrAdmin, updateUser);
router.delete("/:id", verifyToken, requireAdmin, deleteUser);

module.exports = router;
