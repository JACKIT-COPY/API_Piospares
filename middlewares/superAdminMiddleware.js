const superAdminOnly = (req, res, next) => {
    if (req.user && req.user.role === 'SuperAdmin') {
        next();
    } else {
        res.status(403).json({ message: 'Access denied: Super Admin permissions required' });
    }
};

module.exports = superAdminOnly;
