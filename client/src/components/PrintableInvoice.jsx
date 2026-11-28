export default function PrintableInvoice({ open, order, onClose }) {
  if (!open || !order) return null;

  const invoiceNumber = `INV-2026-${String(order.orderNumber || '').replace('ORD-', '')}`;
  const invoiceDate = order.placedAt || new Date().toLocaleString('en-IN');
  const itemsTotal =
    order.itemsTotal ??
    (order.items?.reduce((s, i) => s + (i.price || i.unitPrice || 0) * i.quantity, 0) || 0);
  const deliveryFee = order.deliveryFee ?? 0;
  const savings = order.savings || 0;
  const taxableValue = Math.max(0, itemsTotal - savings);
  const cgst = Math.round(taxableValue * 0.025);
  const sgst = Math.round(taxableValue * 0.025);
  const estimatedGst = cgst + sgst;
  const grandTotal = order.grandTotal ?? taxableValue + deliveryFee;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div id="invoiceModal" className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-3xl w-full max-w-xl max-h-[92vh] overflow-hidden shadow-2xl flex flex-col print:rounded-none print:shadow-none print:max-h-none">
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between no-print">
          <div className="flex items-center gap-2">
            <span className="text-lg">🧾</span>
            <span className="font-black text-sm">Official GST Tax Invoice & Receipt</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition shadow"
            >
              <span>🖨️ Print / PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center font-bold"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="p-6 sm:p-8 space-y-5 overflow-y-auto flex-grow bg-white text-slate-900 font-sans print:p-4">
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4 border-b-2 border-slate-900 pb-4">
            <div>
              <div className="flex items-center gap-2 text-indigo-600 font-black text-xl tracking-tight">
                <span>
                  ⚡ Hyper<span className="text-slate-900">Local</span>
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">Fast Logistics & Local Marketplace Fleet</p>
              <p className="text-[11px] text-slate-400">Sector 62, Noida, UP - 201301</p>
              <p className="text-[10px] text-slate-500 font-mono mt-1">
                Platform GSTIN: 09AABCH9988L1Z2
              </p>
            </div>
            <div className="text-left sm:text-right">
              <span className="text-xs font-black text-slate-900 uppercase tracking-wider block bg-slate-100 px-2 py-0.5 rounded">
                TAX INVOICE / CASH MEMO
              </span>
              <p className="font-black text-slate-900 text-sm mt-1">{invoiceNumber}</p>
              <p className="text-xs text-slate-500 font-mono">Date: {invoiceDate}</p>
              <p className="text-[11px] text-slate-500">
                Order ID: <strong>{order.orderNumber}</strong>
              </p>
              <p className="text-[10px] text-emerald-700 font-bold mt-1">
                Original for Recipient • Duplicate for Supplier
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 space-y-1">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                Sold By (Fulfilling Merchant):
              </span>
              <h4 className="font-black text-slate-900 text-sm">{order.storeName || 'Local Store'}</h4>
              <p className="text-slate-600">Sector 62 Market, Noida, UP 201301</p>
              <p className="text-slate-500 font-mono text-[11px]">GSTIN: 09AABCS1234F1Z5</p>
              <p className="text-slate-500 font-mono text-[11px]">FSSAI: 12723000000123</p>
              <p className="text-slate-500">State Code: 09 (Uttar Pradesh)</p>
              <p className="text-slate-500">Contact: +91 9811223344</p>
            </div>
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 space-y-1">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                Billed & Delivered To:
              </span>
              <h4 className="font-black text-slate-900 text-sm">{order.customerName || 'Customer'}</h4>
              <p className="text-slate-600">{order.deliveryAddress}</p>
              <p className="text-slate-500">PIN: {order.pincode || '—'}</p>
              <p className="text-slate-500">Phone: +91 {order.customerPhone}</p>
              <p className="text-slate-500 font-bold">
                Mode: {order.orderType === 'pickup' ? '🏬 Store Pickup' : '🛵 Doorstep Express'}
              </p>
              <p className="text-slate-500">
                Place of Supply: {order.pincode?.startsWith('56') ? 'Karnataka (29)' : 'Uttar Pradesh (09)'}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100 text-slate-700 uppercase font-black text-[10px]">
                  <th className="py-2.5 px-2">#</th>
                  <th className="py-2.5 px-2">Item / HSN</th>
                  <th className="py-2.5 px-2 text-right">Unit Price</th>
                  <th className="py-2.5 px-2 text-center">Qty</th>
                  <th className="py-2.5 px-2 text-right">Taxable</th>
                  <th className="py-2.5 px-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(order.items || []).map((item, idx) => {
                  const unitPrice = item.price || item.unitPrice || 0;
                  const line = unitPrice * item.quantity;
                  return (
                    <tr key={`${item.productId || item.name}-${idx}`}>
                      <td className="py-2.5 px-2 text-slate-400 font-mono">{idx + 1}</td>
                      <td className="py-2.5 px-2 font-bold text-slate-800">
                        <div>{item.name || item.productName}</div>
                        <div className="text-[10px] text-slate-400 font-normal">
                          {item.unit || item.unitSpec || 'Standard'} • HSN 2106
                        </div>
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono text-slate-700">₹{unitPrice}</td>
                      <td className="py-2.5 px-2 text-center font-bold text-slate-900">{item.quantity}</td>
                      <td className="py-2.5 px-2 text-right font-mono text-slate-600">₹{line}</td>
                      <td className="py-2.5 px-2 text-right font-bold text-slate-900 font-mono">
                        ₹{line}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="border-t border-slate-200 pt-3 flex flex-col sm:flex-row justify-between items-start gap-4 text-xs">
            <div className="space-y-1 text-slate-500 text-[11px]">
              <p>
                <strong>Payment Mode:</strong> {order.paymentMode || 'COD'}
              </p>
              <p>
                <strong>Fulfillment Time Slot:</strong> {order.timeSlot || 'Express'}
              </p>
              <p>
                <strong>Tax Rate:</strong> CGST 2.5% + SGST 2.5% (Inclusive)
              </p>
              <p className="text-[10px] text-slate-400 max-w-xs">
                Goods / services are taxable under CGST Act 2017. E-invoice not applicable for B2C
                micro-merchant supply under this demo invoice.
              </p>
            </div>
            <div className="w-full sm:w-64 space-y-1.5 text-right">
              <div className="flex justify-between text-slate-600">
                <span>Items Subtotal:</span>
                <span className="font-mono font-bold text-slate-900">₹{itemsTotal}</span>
              </div>
              {savings > 0 && (
                <div className="flex justify-between text-emerald-600 font-bold">
                  <span>Discount / Savings:</span>
                  <span className="font-mono">-₹{savings}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-600">
                <span>Taxable Value:</span>
                <span className="font-mono font-bold text-slate-900">₹{taxableValue}</span>
              </div>
              <div className="flex justify-between text-slate-500 text-[11px]">
                <span>CGST @ 2.5%:</span>
                <span className="font-mono">₹{cgst}</span>
              </div>
              <div className="flex justify-between text-slate-500 text-[11px]">
                <span>SGST @ 2.5%:</span>
                <span className="font-mono">₹{sgst}</span>
              </div>
              <div className="flex justify-between text-slate-500 text-[11px]">
                <span>Total GST (Incl.):</span>
                <span className="font-mono">₹{estimatedGst}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Delivery & Handling:</span>
                <span className={`font-mono font-bold ${deliveryFee === 0 ? 'text-emerald-600' : 'text-slate-900'}`}>
                  {deliveryFee === 0 ? 'FREE' : `₹${deliveryFee}`}
                </span>
              </div>
              <div className="border-t-2 border-slate-900 pt-1.5 flex justify-between text-sm font-black text-slate-950">
                <span>Grand Total:</span>
                <span className="text-base text-indigo-600 font-mono">₹{grandTotal}</span>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4 text-center text-[10px] text-slate-400 space-y-1">
            <p>This is a computer-generated GST tax invoice and does not require a physical signature.</p>
            <p>For support, cancellation or returns, contact help@hyperlocal.app or WhatsApp +91 9876543210.</p>
          </div>

          <div className="no-print pt-2">
            <button
              type="button"
              onClick={handlePrint}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-sm shadow-md"
            >
              🖨️ Print / Save as PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
