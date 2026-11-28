import { useMemo, useState } from 'react';
import SearchableSelect from './SearchableSelect';
import {
  PRODUCT_UNIT_TYPES,
  formatProductUnit,
  parseProductUnit
} from '../data/productUnits';

/**
 * Qty + unit-type controls. Writes combined string into hidden `name="unit"`.
 */
export default function UnitPackFields({
  defaultUnit = '',
  required = true,
  inputClassName = 'w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-600',
  name = 'unit',
  labelClassName = 'font-bold text-slate-700 block mb-1 text-xs'
}) {
  const initial = parseProductUnit(defaultUnit);
  const [amount, setAmount] = useState(initial.amount || '');
  const [unitType, setUnitType] = useState(initial.unitType || 'pc');

  const combined = useMemo(
    () => formatProductUnit(amount, unitType),
    [amount, unitType]
  );

  return (
    <div className="grid grid-cols-[1fr_1.2fr] gap-2">
      <div>
        <label className={labelClassName}>Quantity {required ? '*' : ''}</label>
        <input
          type="number"
          min={0}
          step="any"
          required={required}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className={inputClassName}
          aria-label="Pack quantity"
        />
      </div>
      <div>
        <label className={labelClassName}>Unit type {required ? '*' : ''}</label>
        <SearchableSelect
          options={PRODUCT_UNIT_TYPES}
          value={unitType}
          onChange={setUnitType}
          placeholder="Select unit type"
          required={required}
        />
      </div>
      <input type="hidden" name={name} value={combined} required={required} />
      {combined ? (
        <p className="col-span-2 text-[10px] font-semibold text-slate-500">
          Saved as: <span className="text-slate-800">{combined}</span>
        </p>
      ) : null}
    </div>
  );
}
