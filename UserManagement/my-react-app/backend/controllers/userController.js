const UserRepository = require("../repositories/userRepository");

let activeUserRepo = new UserRepository();

exports.setUserRepository = (repo) => {
  activeUserRepo = repo;
};

exports.getUserRepository = () => activeUserRepo;

/**
 * 1. Get All Users (Admin)
 * GET /api/users
 */
exports.getUsers = async (req, res) => {
  try {
    const { search } = req.query;
    const result = await activeUserRepo.listUsers({ search });
    return res.json(result.users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * 2. Update User Profile / Role
 * PUT /api/users/:id
 */
exports.updateUser = async (req, res) => {
  try {
    const { name, email, role, age, country, phone } = req.body;
    const userId = req.params.id;

    const updated = await activeUserRepo.update(userId, {
      name,
      email,
      role,
      age,
      country,
      phone
    });

    const sanitizedUser = { ...updated };
    delete sanitizedUser.password;

    return res.json({ message: "User updated successfully", user: sanitizedUser });
  } catch (error) {
    const statusCode = error.statusCode || error.status || 500;
    res.status(statusCode).json({ message: error.message });
  }
};

/**
 * 3. Delete User
 * DELETE /api/users/:id
 */
exports.deleteUser = async (req, res) => {
  try {
    const userId = req.params.id;
    const deleted = await activeUserRepo.delete(userId);
    if (!deleted) {
      return res.status(404).json({ message: "User not found" });
    }
    return res.json({ message: "User deleted successfully" });
  } catch (error) {
    const statusCode = error.statusCode || error.status || 500;
    res.status(statusCode).json({ message: error.message });
  }
};
