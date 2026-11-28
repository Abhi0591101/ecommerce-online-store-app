import { useCallback, useEffect, useState } from 'react';
import { usePlatform } from '../context/PlatformContext';
import SearchableSelect from './SearchableSelect';

const DEFAULT_CAT_PHOTO =
  'https://images.unsplash.com/photo-1542838132-92c53300491e?w=160&auto=format&fit=crop&q=80';

const inputCls =
  'w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-800 bg-white';

/**
 * Full Category Master (create / edit / drag-reorder / on-off / delete).
 * Lives inside Admin Panel — no separate StoreAdmin / platform_ops screen.
 */
export default function AdminCategoryMaster({ onNotify, askConfirm }) {
  const {
    categoryTree,
    mainCategories,
    subcategoriesOf,
    addCategory,
    editCategory,
    toggleCategoryActive,
    reorderCategoryList,
    removeCategory
  } = usePlatform();

  const notify = onNotify || (() => {});

  const [catFormMode, setCatFormMode] = useState('main');
  const [catParentId, setCatParentId] = useState('');
  const [savingCategory, setSavingCategory] = useState(false);
  const [expandedMainId, setExpandedMainId] = useState('');
  const [editingCategory, setEditingCategory] = useState(null);
  const [catDraft, setCatDraft] = useState({
    name: '',
    nameHi: '',
    iconEmoji: '🛒',
    photoUrl: '',
    requiresLicence: false
  });
  const [mainList, setMainList] = useState([]);
  const [dragMainId, setDragMainId] = useState('');
  const [dragSub, setDragSub] = useState(null);
  const [reordering, setReordering] = useState(false);

  useEffect(() => {
    const tree = categoryTree.length
      ? categoryTree
      : mainCategories.map((m) => ({
          ...m,
          subcategories: subcategoriesOf(m._id)
        }));
    setMainList(
      [...tree]
        .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
        .map((m) => ({
          ...m,
          subcategories: [...(m.subcategories || [])].sort(
            (a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)
          )
        }))
    );
  }, [categoryTree, mainCategories, subcategoriesOf]);

  const clearCategoryEdit = useCallback(() => {
    setEditingCategory(null);
    setCatDraft({
      name: '',
      nameHi: '',
      iconEmoji: catFormMode === 'sub' ? '📁' : '🛒',
      photoUrl: '',
      requiresLicence: false
    });
  }, [catFormMode]);

  const startEditCategory = (cat, asSub = false) => {
    setEditingCategory(cat);
    setCatFormMode(asSub || cat.parentId ? 'sub' : 'main');
    const parent =
      typeof cat.parentId === 'object' && cat.parentId
        ? cat.parentId._id || cat.parentId.id
        : cat.parentId;
    setCatParentId(parent ? String(parent) : '');
    setCatDraft({
      name: cat.name || '',
      nameHi: cat.nameHi || '',
      iconEmoji: cat.iconEmoji || (asSub ? '📁' : '🛒'),
      photoUrl: cat.photoUrl || '',
      requiresLicence: Boolean(cat.requiresLicence)
    });
  };

  const onCategoryImageFile = (file) => {
    if (!file) return;
    if (!file.type?.startsWith('image/')) {
      notify('Please upload an image file');
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      notify('Image must be under 4MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setCatDraft((d) => ({ ...d, photoUrl: String(reader.result || '') }));
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteCategory = async (cat, isMain = false) => {
    const label = isMain ? 'main category (and its subcategories)' : 'subcategory';
    const message = `Delete ${label} "${cat.name}"? Products under it will be deactivated. This cannot be undone.`;
    const ok = askConfirm
      ? await askConfirm(message, 'Delete category')
      : window.confirm(message);
    if (!ok) return;
    try {
      await removeCategory(cat._id, { cascade: true, force: true });
      if (editingCategory && String(editingCategory._id) === String(cat._id)) clearCategoryEdit();
      notify(`Deleted "${cat.name}"`);
    } catch (err) {
      notify(err.message || 'Delete failed');
    }
  };

  const persistMainOrder = async (list) => {
    setReordering(true);
    try {
      await reorderCategoryList(list.map((c, idx) => ({ id: c._id, displayOrder: idx + 1 })));
      notify('Category order saved');
    } catch (err) {
      notify(err.message || 'Reorder failed');
    } finally {
      setReordering(false);
    }
  };

  const persistSubOrder = async (mainId, subs) => {
    setReordering(true);
    try {
      await reorderCategoryList(subs.map((c, idx) => ({ id: c._id, displayOrder: idx + 1 })));
      notify('Subcategory order saved');
    } catch (err) {
      notify(err.message || 'Reorder failed');
    } finally {
      setReordering(false);
    }
  };

  const onMainDrop = async (targetId) => {
    if (!dragMainId || String(dragMainId) === String(targetId)) {
      setDragMainId('');
      return;
    }
    const from = mainList.findIndex((c) => String(c._id) === String(dragMainId));
    const to = mainList.findIndex((c) => String(c._id) === String(targetId));
    if (from < 0 || to < 0) {
      setDragMainId('');
      return;
    }
    const next = [...mainList];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setMainList(next);
    setDragMainId('');
    await persistMainOrder(next);
  };

  const onSubDrop = async (mainId, targetSubId) => {
    if (!dragSub || String(dragSub.mainId) !== String(mainId)) {
      setDragSub(null);
      return;
    }
    if (String(dragSub.subId) === String(targetSubId)) {
      setDragSub(null);
      return;
    }
    setMainList((prev) =>
      prev.map((main) => {
        if (String(main._id) !== String(mainId)) return main;
        const subs = [...(main.subcategories || [])];
        const from = subs.findIndex((s) => String(s._id) === String(dragSub.subId));
        const to = subs.findIndex((s) => String(s._id) === String(targetSubId));
        if (from < 0 || to < 0) return main;
        const [moved] = subs.splice(from, 1);
        subs.splice(to, 0, moved);
        queueMicrotask(() => persistSubOrder(mainId, subs));
        return { ...main, subcategories: subs };
      })
    );
    setDragSub(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-black text-slate-900 text-sm">Category Master</h3>
          <p className="text-xs font-semibold text-slate-500 mt-0.5">
            Add / edit categories, upload icon, drag ⋮⋮ to reorder. Sellers only see active ones.
          </p>
        </div>
        {reordering ? (
          <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full">
            Saving order…
          </span>
        ) : null}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const name = String(catDraft.name || '').trim();
            if (!name) return;
            if (catFormMode === 'sub' && !catParentId && !editingCategory) {
              notify('Select a parent main category for the subcategory.');
              return;
            }
            if (!editingCategory && !catDraft.photoUrl) {
              notify('Please upload a category image/icon');
              return;
            }
            setSavingCategory(true);
            try {
              const payload = {
                name,
                nameHi: catDraft.nameHi || '',
                iconEmoji: catDraft.iconEmoji || (catFormMode === 'sub' ? '📁' : '🛒'),
                photoUrl: catDraft.photoUrl || DEFAULT_CAT_PHOTO,
                requiresLicence: Boolean(catDraft.requiresLicence),
                parentId: catFormMode === 'sub' ? catParentId || null : null
              };
              if (editingCategory?._id) {
                await editCategory(editingCategory._id, payload);
                notify(`Updated "${name}"`);
                clearCategoryEdit();
              } else {
                await addCategory({ ...payload, isActive: true });
                notify(
                  catFormMode === 'sub' ? `Subcategory "${name}" created` : `Category "${name}" created`
                );
                clearCategoryEdit();
              }
            } catch (err) {
              notify(err.message || 'Failed to save category');
            } finally {
              setSavingCategory(false);
            }
          }}
          className="bg-white rounded-xl p-4 border border-slate-200 space-y-3 text-xs"
        >
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg w-fit">
              {[
                ['main', 'Main Category'],
                ['sub', 'Subcategory']
              ].map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setCatFormMode(id);
                    if (!editingCategory) {
                      setCatDraft((d) => ({ ...d, iconEmoji: id === 'sub' ? '📁' : '🛒' }));
                    }
                  }}
                  disabled={Boolean(editingCategory)}
                  className={`px-2.5 py-1 rounded-md font-bold text-[11px] transition ${
                    catFormMode === id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {editingCategory ? (
              <button
                type="button"
                onClick={clearCategoryEdit}
                className="text-[10px] font-bold text-slate-500 hover:text-slate-900"
              >
                Cancel edit
              </button>
            ) : null}
          </div>

          <h4 className="font-black text-slate-900 text-sm">
            {editingCategory
              ? `Edit: ${editingCategory.name}`
              : catFormMode === 'sub'
                ? 'Add Subcategory'
                : 'Add Main Category'}
          </h4>

          {catFormMode === 'sub' ? (
            <div>
              <label className="font-bold text-slate-600 block mb-1">Parent Main Category *</label>
              <SearchableSelect
                options={mainCategories.map((c) => ({ value: c._id, label: c.name }))}
                value={catParentId}
                onChange={setCatParentId}
                placeholder="Search main category…"
                required
              />
            </div>
          ) : null}

          <div>
            <label className="font-bold text-slate-600 block mb-1">Name *</label>
            <input
              required
              value={catDraft.name}
              onChange={(e) => setCatDraft((d) => ({ ...d, name: e.target.value }))}
              className={inputCls}
            />
          </div>
          <div>
            <label className="font-bold text-slate-600 block mb-1">Hindi name</label>
            <input
              value={catDraft.nameHi}
              onChange={(e) => setCatDraft((d) => ({ ...d, nameHi: e.target.value }))}
              className={inputCls}
            />
          </div>
          <div>
            <label className="font-bold text-slate-600 block mb-1">Emoji icon</label>
            <input
              value={catDraft.iconEmoji}
              onChange={(e) => setCatDraft((d) => ({ ...d, iconEmoji: e.target.value }))}
              className={inputCls}
            />
          </div>

          <div>
            <label className="font-bold text-slate-600 block mb-1.5">
              Image / Icon {editingCategory ? '' : '*'}
            </label>
            <div className="grid grid-cols-[80px_1fr] gap-3 items-start">
              <div className="w-20 h-20 rounded-xl border border-dashed border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center">
                {catDraft.photoUrl ? (
                  <img
                    src={catDraft.photoUrl}
                    alt="Category"
                    className="w-full h-full object-cover"
                    onError={(ev) => {
                      ev.currentTarget.src = DEFAULT_CAT_PHOTO;
                    }}
                  />
                ) : (
                  <span className="text-[9px] text-slate-400 font-bold">Preview</span>
                )}
              </div>
              <div className="space-y-2">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(ev) => onCategoryImageFile(ev.target.files?.[0])}
                  className="w-full text-[11px]"
                />
                {catDraft.photoUrl ? (
                  <button
                    type="button"
                    onClick={() => setCatDraft((d) => ({ ...d, photoUrl: '' }))}
                    className="text-[10px] font-bold text-rose-600"
                  >
                    Remove image
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          {catFormMode === 'main' ? (
            <label className="flex items-center gap-2 font-bold text-slate-700">
              <input
                type="checkbox"
                checked={catDraft.requiresLicence}
                onChange={(e) => setCatDraft((d) => ({ ...d, requiresLicence: e.target.checked }))}
              />
              Regulated (requires seller licence) — e.g. Pharmacy
            </label>
          ) : null}

          <button
            type="submit"
            disabled={savingCategory}
            className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white rounded-lg font-black text-xs"
          >
            {savingCategory
              ? 'Saving…'
              : editingCategory
                ? 'Update Category'
                : catFormMode === 'sub'
                  ? 'Create Subcategory'
                  : 'Create Main Category'}
          </button>
        </form>

        <div className="bg-white rounded-xl p-4 border border-slate-200 space-y-2 max-h-[70vh] overflow-y-auto">
          <h4 className="font-black text-slate-900 text-sm sticky top-0 bg-white pb-2 z-10">
            Live tree ({mainList.length} mains) — drag ⋮⋮ to reorder
          </h4>
          {mainList.map((main) => {
            const mainId = main._id;
            const open = expandedMainId === String(mainId);
            const subs = main.subcategories || [];
            const draggingMain = String(dragMainId) === String(mainId);
            return (
              <div
                key={mainId}
                className={`border rounded-xl overflow-hidden transition ${
                  draggingMain ? 'border-slate-400 ring-2 ring-slate-200 opacity-80' : 'border-slate-100'
                }`}
                draggable
                onDragStart={(e) => {
                  setDragMainId(String(mainId));
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  onMainDrop(mainId);
                }}
                onDragEnd={() => setDragMainId('')}
              >
                <div className="flex items-center gap-2 p-2.5 bg-slate-50">
                  <span className="cursor-grab active:cursor-grabbing text-slate-400 font-black text-sm px-1 select-none">
                    ⋮⋮
                  </span>
                  <img
                    src={main.photoUrl || DEFAULT_CAT_PHOTO}
                    alt=""
                    className="w-8 h-8 rounded-lg object-cover border border-slate-200 shrink-0"
                    onError={(ev) => {
                      ev.currentTarget.src = DEFAULT_CAT_PHOTO;
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setExpandedMainId(open ? '' : String(mainId))}
                    className="text-left flex-grow min-w-0"
                  >
                    <p className="font-black text-xs text-slate-900 truncate">
                      {main.iconEmoji} {main.name}
                      {main.nameHi ? (
                        <span className="text-slate-400 font-bold"> · {main.nameHi}</span>
                      ) : null}
                    </p>
                    <p className="text-[10px] text-slate-400 font-bold">
                      {subs.length} sub
                      {main.requiresLicence ? ' · licence' : ''}
                      {main.isActive === false ? ' · inactive' : ''}
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => startEditCategory(main, false)}
                    className="px-2 py-1 rounded-lg font-bold text-[10px] bg-white border border-slate-200 text-slate-700"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await toggleCategoryActive(mainId, main.isActive === false);
                        notify(main.isActive === false ? 'Category activated' : 'Category deactivated');
                      } catch (err) {
                        notify(err.message);
                      }
                    }}
                    className={`px-2 py-1 rounded-lg font-bold text-[10px] ${
                      main.isActive === false
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {main.isActive === false ? 'On' : 'Off'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteCategory(main, true)}
                    className="px-2 py-1 rounded-lg font-bold text-[10px] bg-rose-100 text-rose-700"
                  >
                    Del
                  </button>
                </div>
                {open ? (
                  <div className="p-2 space-y-1.5">
                    {subs.length === 0 ? (
                      <p className="text-[10px] text-slate-400 px-2 py-1">No subcategories yet</p>
                    ) : null}
                    {subs.map((sub) => (
                      <div
                        key={sub._id}
                        draggable
                        onDragStart={(e) => {
                          e.stopPropagation();
                          setDragSub({ mainId: String(mainId), subId: String(sub._id) });
                          e.dataTransfer.effectAllowed = 'move';
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          e.dataTransfer.dropEffect = 'move';
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onSubDrop(mainId, sub._id);
                        }}
                        onDragEnd={() => setDragSub(null)}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded-lg bg-white border ${
                          dragSub?.subId === String(sub._id)
                            ? 'border-slate-400 ring-1 ring-slate-200'
                            : 'border-slate-100'
                        }`}
                      >
                        <span className="cursor-grab active:cursor-grabbing text-slate-300 text-xs select-none">
                          ⋮⋮
                        </span>
                        <img
                          src={sub.photoUrl || main.photoUrl || DEFAULT_CAT_PHOTO}
                          alt=""
                          className="w-6 h-6 rounded-md object-cover border border-slate-100 shrink-0"
                        />
                        <div className="flex-grow min-w-0">
                          <p className="font-bold text-[11px] text-slate-800 truncate">{sub.name}</p>
                          <p className="text-[9px] text-slate-400 font-mono truncate">{sub.slug}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => startEditCategory(sub, true)}
                          className="px-1.5 py-0.5 rounded font-bold text-[10px] bg-slate-50 text-slate-700 border border-slate-200"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await toggleCategoryActive(sub._id, sub.isActive === false);
                            } catch (err) {
                              notify(err.message);
                            }
                          }}
                          className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${
                            sub.isActive === false
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-amber-50 text-amber-800'
                          }`}
                        >
                          {sub.isActive === false ? 'On' : 'Off'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCategory(sub, false)}
                          className="px-1.5 py-0.5 rounded font-bold text-[10px] bg-rose-50 text-rose-700"
                        >
                          Del
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
