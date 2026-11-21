const mongoose = require('mongoose');
const Category = require('../models/Category');

const slugify = (name) =>
  String(name || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const DEFAULT_PHOTO =
  'https://images.unsplash.com/photo-1542838132-92c53300491e?w=160&auto=format&fit=crop&q=80';

const toPublic = (doc) => {
  if (!doc) return null;
  const o = doc.toObject ? doc.toObject() : doc;
  return {
    ...o,
    id: o._id,
    isMain: !o.parentId,
    level: o.parentId ? 'subcategory' : 'main'
  };
};

// GET /api/categories
// query: tree=1 | type=main|sub | parentId= | includeInactive=1 (admin)
const getCategories = async (req, res, next) => {
  try {
    const { tree, type, parentId, includeInactive } = req.query;
    const filter = {};
    const wantInactive = includeInactive === '1' || includeInactive === 'true';
    // Inactive categories only for authenticated Super Admin
    const canSeeInactive = req.user?.role === 'superadmin';

    if (!wantInactive || !canSeeInactive) {
      filter.isActive = true;
    }

    if (type === 'main') {
      filter.parentId = null;
    } else if (type === 'sub') {
      filter.parentId = { $ne: null };
      if (parentId && mongoose.isValidObjectId(parentId)) {
        filter.parentId = parentId;
      }
    } else if (parentId === 'null' || parentId === '') {
      filter.parentId = null;
    } else if (parentId && mongoose.isValidObjectId(parentId)) {
      filter.parentId = parentId;
    }

    if (tree === '1' || tree === 'true') {
      const allFilter = wantInactive && canSeeInactive ? {} : { isActive: true };
      const all = await Category.find(allFilter).sort({ displayOrder: 1, name: 1 });
      const mainCats = all.filter((c) => !c.parentId);
      const subs = all.filter((c) => c.parentId);
      const data = mainCats.map((main) => ({
        ...toPublic(main),
        subcategories: subs
          .filter((s) => String(s.parentId) === String(main._id))
          .map(toPublic)
      }));
      return res.json({ success: true, data });
    }

    const categories = await Category.find(filter)
      .sort({ displayOrder: 1, name: 1 })
      .populate('parentId', 'name slug');

    res.json({
      success: true,
      data: categories.map(toPublic)
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/categories — Super Admin only
const createCategory = async (req, res, next) => {
  try {
    const {
      name,
      nameHi,
      iconEmoji,
      photoUrl,
      slug,
      displayOrder,
      parentId,
      requiresLicence,
      isActive
    } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: 'Category name required' });
    }

    let parent = null;
    if (parentId) {
      if (!mongoose.isValidObjectId(parentId)) {
        return res.status(400).json({ success: false, message: 'Invalid parentId' });
      }
      parent = await Category.findById(parentId);
      if (!parent) {
        return res.status(400).json({ success: false, message: 'Parent category not found' });
      }
      if (parent.parentId) {
        return res.status(400).json({
          success: false,
          message: 'Subcategories can only be nested under a main category'
        });
      }
    }

    const finalSlug = slug || slugify(name);
    const exists = await Category.findOne({ slug: finalSlug });
    if (exists) {
      return res.status(409).json({ success: false, message: 'Category slug already exists' });
    }

    const siblingFilter = parent ? { parentId: parent._id } : { parentId: null };
    const maxOrder = await Category.findOne(siblingFilter)
      .sort({ displayOrder: -1 })
      .select('displayOrder');

    const category = await Category.create({
      name: String(name).trim(),
      nameHi: nameHi || '',
      slug: finalSlug,
      iconEmoji: iconEmoji || (parent ? '📁' : '🛒'),
      photoUrl: photoUrl || parent?.photoUrl || DEFAULT_PHOTO,
      displayOrder:
        displayOrder != null ? Number(displayOrder) : (maxOrder?.displayOrder || 0) + 1,
      parentId: parent ? parent._id : null,
      requiresLicence: Boolean(requiresLicence) || Boolean(parent?.requiresLicence),
      isActive: isActive !== false
    });

    res.status(201).json({ success: true, data: toPublic(category) });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/categories/:id — Super Admin only
const updateCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Invalid category id' });
    }

    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    const {
      name,
      nameHi,
      iconEmoji,
      photoUrl,
      slug,
      displayOrder,
      isActive,
      requiresLicence,
      parentId
    } = req.body;

    if (name != null) category.name = String(name).trim();
    if (nameHi != null) category.nameHi = nameHi;
    if (iconEmoji != null) category.iconEmoji = iconEmoji;
    if (photoUrl != null) category.photoUrl = photoUrl;
    if (displayOrder != null) category.displayOrder = Number(displayOrder);
    if (isActive != null) category.isActive = Boolean(isActive);
    if (requiresLicence != null) category.requiresLicence = Boolean(requiresLicence);

    if (slug != null && slug !== category.slug) {
      const clash = await Category.findOne({ slug, _id: { $ne: category._id } });
      if (clash) {
        return res.status(409).json({ success: false, message: 'Category slug already exists' });
      }
      category.slug = slugify(slug);
    }

    // Allow moving a subcategory under another main (not nesting mains)
    if (parentId !== undefined) {
      if (parentId === null || parentId === '') {
        category.parentId = null;
      } else {
        if (!mongoose.isValidObjectId(parentId)) {
          return res.status(400).json({ success: false, message: 'Invalid parentId' });
        }
        if (String(parentId) === String(category._id)) {
          return res.status(400).json({ success: false, message: 'Category cannot be its own parent' });
        }
        const parent = await Category.findById(parentId);
        if (!parent || parent.parentId) {
          return res.status(400).json({
            success: false,
            message: 'Parent must be an existing main category'
          });
        }
        // Cannot turn a main that has children into a subcategory without cleanup
        if (!category.parentId) {
          const childCount = await Category.countDocuments({ parentId: category._id });
          if (childCount > 0) {
            return res.status(400).json({
              success: false,
              message: 'Deactivate or reassign subcategories before changing this main category'
            });
          }
        }
        category.parentId = parent._id;
      }
    }

    await category.save();
    res.json({ success: true, data: toPublic(category) });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/categories/:id/status — activate / deactivate
const setCategoryStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Invalid category id' });
    }
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ success: false, message: 'isActive boolean required' });
    }

    const category = await Category.findByIdAndUpdate(
      id,
      { isActive },
      { new: true }
    );
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    // Cascade deactivate subcategories when main is deactivated
    if (!category.parentId && isActive === false) {
      await Category.updateMany({ parentId: category._id }, { isActive: false });
    }

    res.json({ success: true, data: toPublic(category) });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/categories/reorder — [{ id, displayOrder }]
const reorderCategories = async (req, res, next) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items) || !items.length) {
      return res.status(400).json({ success: false, message: 'items array required' });
    }

    const ops = items
      .filter((row) => row.id && mongoose.isValidObjectId(row.id) && row.displayOrder != null)
      .map((row) => ({
        updateOne: {
          filter: { _id: row.id },
          update: { $set: { displayOrder: Number(row.displayOrder) } }
        }
      }));

    if (!ops.length) {
      return res.status(400).json({ success: false, message: 'No valid reorder rows' });
    }

    await Category.bulkWrite(ops);
    const ids = items.map((i) => i.id);
    const updated = await Category.find({ _id: { $in: ids } }).sort({ displayOrder: 1 });
    res.json({ success: true, data: updated.map(toPublic) });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/categories/:id — Super Admin only
// cascade=1 also deletes child subcategories (required for main with children)
// force=1 also removes product links by deactivating products that reference the category
const deleteCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const cascade = req.query.cascade === '1' || req.query.cascade === 'true' || req.body?.cascade;
    const force = req.query.force === '1' || req.query.force === 'true' || req.body?.force;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Invalid category id' });
    }

    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    const Product = require('../models/Product');
    const childIds = [];

    if (!category.parentId) {
      const children = await Category.find({ parentId: category._id }).select('_id');
      childIds.push(...children.map((c) => c._id));
      if (children.length && !cascade) {
        return res.status(400).json({
          success: false,
          message: `This main category has ${children.length} subcategories. Delete with cascade=true or remove subs first.`,
          subcategoryCount: children.length
        });
      }
    }

    const idsToRemove = [category._id, ...childIds];
    const productFilter = {
      $or: [
        { categoryId: { $in: idsToRemove } },
        { subcategoryId: { $in: idsToRemove } }
      ]
    };
    const productCount = await Product.countDocuments(productFilter);

    if (productCount > 0 && !force) {
      return res.status(400).json({
        success: false,
        message: `${productCount} product(s) still use this category. Confirm delete with force=true (products will be deactivated), or reassign products first.`,
        productCount
      });
    }

    if (productCount > 0 && force) {
      await Product.updateMany(productFilter, {
        $set: { isActive: false, status: 'inactive' }
      });
    }

    await Category.deleteMany({ _id: { $in: idsToRemove } });

    res.json({
      success: true,
      message: 'Category deleted',
      data: {
        deletedIds: idsToRemove,
        deactivatedProducts: force ? productCount : 0
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCategories,
  createCategory,
  updateCategory,
  setCategoryStatus,
  reorderCategories,
  deleteCategory
};
