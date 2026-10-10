function amount(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function percentage(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export function calculateBill(values = {}) {
  const workDone = amount(values.work_done_amount);
  const cultureCess = workDone * percentage(values.culture_cess_percent) / 100;
  const totalBeforeRebate = workDone + cultureCess;
  const rebate = totalBeforeRebate * percentage(values.rebate_percent) / 100;
  const amountAfterRebate = totalBeforeRebate - rebate;
  const escalation = amount(values.escalation_amount);
  const escalationAdjustment = values.escalation_type === 'Add'
    ? escalation
    : values.escalation_type === 'Deduct'
      ? -escalation
      : 0;
  const gross = Math.max(0, amountAfterRebate + escalationAdjustment);
  const deductions = [
    { label: 'Security', amount: gross * percentage(values.security_percent) / 100 },
    { label: 'CGST', amount: gross * percentage(values.cgst_percent) / 100 },
    { label: 'SGST', amount: gross * percentage(values.sgst_percent) / 100 },
    { label: 'Income tax', amount: gross * percentage(values.income_tax_percent) / 100 },
    { label: 'Labour cess', amount: gross * percentage(values.labour_cess_percent) / 100 },
    { label: 'Construction cess', amount: gross * percentage(values.construction_cess_percent) / 100 },
    { label: 'TPA', amount: amount(values.tpa_amount) },
    { label: 'Withheld', amount: amount(values.withheld_amount) },
    {
      label: values.other_deduction_description || values.other_deduction_type || 'Other deduction',
      amount: amount(values.other_deduction_amount),
    },
  ];
  const totalDeduction = deductions.reduce((total, deduction) => total + deduction.amount, 0);

  return {
    workDone,
    cultureCess,
    totalBeforeRebate,
    rebate,
    amountAfterRebate,
    escalationAdjustment,
    gross,
    deductions,
    totalDeduction,
    netPayable: Math.max(0, gross - totalDeduction),
  };
}
