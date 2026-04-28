import React, { useEffect, useState } from "react";
import { apiFetch } from "../../services/httpClient"; 

const FeeManagement = () => {
  const [feeData, setFeeData] = useState([]);
  const [selectedEnrollment, setSelectedEnrollment] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [transactionInfo, setTransactionInfo] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const fetchFees = async () => {
    try {
      const data = await apiFetch("/admin/fees", { withAuth: true });
      setFeeData(Array.isArray(data) ? data : []);
    } catch (err) { 
      console.error("Fetch error", err); 
    }
  };

  useEffect(() => { fetchFees(); }, []);

  const handlePayment = async () => {
    if (!selectedEnrollment) return;
    try {
      setErrorMsg("");
      await apiFetch("/admin/fees/pay", {
        method: "POST",
        body: {
          enrollment_id: selectedEnrollment.enrollment_id,
          month_number: selectedEnrollment.paid_months + 1,
          payment_method: paymentMethod,
          transaction_info: transactionInfo,
          amount_paid: selectedEnrollment.monthly_fee, // Passes the effective fee as amount paid
        },
        withAuth: true,
      });
      
      setSelectedEnrollment(null);
      setPaymentMethod("");
      setTransactionInfo("");
      setSuccessMsg(`Payment for ${selectedEnrollment.student_name} recorded successfully!`);
      
      fetchFees(); 
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err) { 
      setErrorMsg(err.message || "Failed to record payment."); 
    }
  };

  return (
    <div className="container mt-4">
      <div className="d-flex justify-content-between align-items-center">
        <h3>Fee Management</h3>
      </div>

      {successMsg && <div className="alert alert-success mt-3">{successMsg}</div>}

      <main className="batch-main" style={{ marginTop: '20px' }}>
        <table className="materials-table" style={{ width: '100%' }}>
          <thead>
          <tr>
            <th>Student Name</th>
            <th>Batch</th>
            <th>Monthly Fee</th>
            <th>Total Fee Due</th>
            <th>Progress</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {feeData.length > 0 ? (
            feeData.map((item) => {
              const isFullyPaid = item.paid_months >= item.duration_months;
              
              return (
                <tr key={item.enrollment_id}>
                  <td className="align-middle"><strong>{item.student_name}</strong></td>
                  <td className="align-middle">{item.batch_name}</td>
                  <td className="align-middle">৳{item.monthly_fee}</td>
                  <td className="align-middle">৳{item.total_fee}</td>
                  <td className="align-middle">
                      <div className="small text-muted mb-1">{item.paid_months} / {item.duration_months} Months Paid</div>
                      <div className="progress" style={{ height: '6px' }}>
                          <div 
                              className="progress-bar bg-success" 
                              style={{ width: `${Math.min((item.paid_months / item.duration_months) * 100, 100)}%` }}
                          ></div>
                      </div>
                  </td>
                  <td className="align-middle">
                    <button 
                      className={`btn btn-sm ${isFullyPaid ? 'btn-secondary' : 'btn-primary'}`}
                      data-toggle="modal" data-target="#payModal"
                      onClick={() => {
                        setSelectedEnrollment(item);
                        setErrorMsg("");
                      }}
                      disabled={isFullyPaid}
                    >
                      {isFullyPaid ? 'Fully Paid' : 'Record Payment'}
                    </button>
                  </td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan="6" className="text-center py-5 text-muted">
                No active enrollments found. <br/>
                <small>Note: Students must be assigned to a Batch in the "Batches" section to appear here.</small>
              </td>
            </tr>
          )}
        </tbody>
      </table>
      </main>
      <div className="modal fade" id="payModal" tabIndex="-1" role="dialog">
        <div className="modal-dialog" role="document">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">Record Payment</h5>
            </div>
            <div className="modal-body">
              {errorMsg && <div className="alert alert-danger">{errorMsg}</div>}
              
              {selectedEnrollment && (
                <div className="mb-3 p-3 bg-light rounded border">
                  <p className="mb-1"><strong>Student:</strong> {selectedEnrollment.student_name}</p>
                  <p className="mb-1"><strong>Batch:</strong> {selectedEnrollment.batch_name}</p>
                  <p className="mb-1 text-primary"><strong>Paying for Month #{selectedEnrollment.paid_months + 1}</strong></p>
                  <p className="mb-0"><strong>Amount Due:</strong> ৳{selectedEnrollment.monthly_fee}</p>
                </div>
              )}
              
              <div className="form-group">
                <label>Payment Method</label>
                <select className="form-control" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                  <option value="">Select Method...</option>
                  <option value="Cash">Cash</option>
                  <option value="bKash">bKash</option>
                  <option value="Nagad">Nagad</option>
                  <option value="Bank">Bank Transfer</option>
                </select>
              </div>
              <div className="form-group mt-3">
                <label>Transaction Info / Reference</label>
                <input 
                  className="form-control" 
                  type="text" 
                  placeholder="e.g. TRX12345 or Receipt No"
                  value={transactionInfo}
                  onChange={e => setTransactionInfo(e.target.value)} 
                />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" data-dismiss="modal" onClick={() => setErrorMsg("")}>Cancel</button>
              <button type="button" className="btn btn-success" onClick={handlePayment} data-dismiss="modal" disabled={!paymentMethod}>
                Confirm Payment
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FeeManagement;