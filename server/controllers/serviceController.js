const Service = require('../models/Service');

const getServices = async (req, res, next) => {
  try {
    const { category, city, q } = req.query;
    const filter = { isActive: true, status: 'approved' };
    if (category) filter.category = category;
    if (city) filter.city = new RegExp(city, 'i');
    if (q) {
      filter.$or = [
        { name: new RegExp(q, 'i') },
        { description: new RegExp(q, 'i') },
        { 'provider.name': new RegExp(q, 'i') }
      ];
    }

    const services = await Service.find(filter).sort({ rating: -1, createdAt: -1 });
    res.json({ success: true, data: services });
  } catch (error) {
    next(error);
  }
};

const createService = async (req, res, next) => {
  try {
    const {
      name,
      category,
      visitCharge,
      photoUrl,
      description,
      provider,
      city,
      rating,
      reviews,
      status
    } = req.body;

    if (!name || visitCharge == null || !photoUrl || !provider?.name || !provider?.phone) {
      return res.status(400).json({
        success: false,
        message: 'name, visitCharge, photoUrl, and provider name/phone are required'
      });
    }

    const isAdmin = req.user?.role === 'superadmin';
    const service = await Service.create({
      name,
      category: category || 'other',
      visitCharge: Number(visitCharge),
      photoUrl,
      description: description || '',
      provider,
      city: city || 'Noida',
      rating: rating != null ? Number(rating) : 4.8,
      reviews: reviews != null ? Number(reviews) : 0,
      status: isAdmin ? (status || 'approved') : 'pending',
      isActive: true
    });

    res.status(201).json({ success: true, data: service });
  } catch (error) {
    next(error);
  }
};

const updateService = async (req, res, next) => {
  try {
    const service = await Service.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });
    if (!service) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }
    res.json({ success: true, data: service });
  } catch (error) {
    next(error);
  }
};

const deleteService = async (req, res, next) => {
  try {
    const service = await Service.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );
    if (!service) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }
    res.json({ success: true, data: service, message: 'Service deactivated' });
  } catch (error) {
    next(error);
  }
};

module.exports = { getServices, createService, updateService, deleteService };
