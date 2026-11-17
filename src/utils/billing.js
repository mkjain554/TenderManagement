function amount(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function percentage(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export function calculateBill(values = {}, applyGst = true) {
  const workDone = amount(values.work_done_amount);
  const escalation = amount(values.escalation_amount);
  const escalationAdjustment = values.escalation_type === 'Add'
    ? escalation
    : values.escalation_type === 'Deduct'
      ? -escalation
      : 0;
  const workAfterEscalationAdjustment = Math.max(0, workDone + escalationAdjustment);
  const cultureCess = workAfterEscalationAdjustment * percentage(values.culture_cess_percent) / 100;
  const totalBeforeRebate = workAfterEscalationAdjustment + cultureCess;
  const rebateBase = (values.rebate_include_escalation === 'Include'
    ? workAfterEscalationAdjustment
    : workDone) + cultureCess;
  const rebate = rebateBase * percentage(values.rebate_percent) / 100;
  const amountAfterRebate = totalBeforeRebate - rebate;
  const escalationAdjustmentAmount = amount(values.escalation_adjustment_amount);
  const additionalEscalationAdjustment = values.escalation_adjustment_type === 'Add'
    ? escalationAdjustmentAmount
    : values.escalation_adjustment_type === 'Deduct'
      ? -escalationAdjustmentAmount
      : 0;
  const totalAdjustments = escalationAdjustment + additionalEscalationAdjustment;
  const previousBillAmount = amount(values.previous_bill_amount);
  const totalAfterPriceAdjustment = amountAfterRebate + additionalEscalationAdjustment;
  const gross = Math.max(0, totalAfterPriceAdjustment - previousBillAmount);
  const deductions = [
    { label: 'Security', amount: gross * percentage(values.security_percent) / 100 },
    ...(applyGst ? [
      { label: 'CGST', amount: gross * percentage(values.cgst_percent) / 100 },
      { label: 'SGST', amount: gross * percentage(values.sgst_percent) / 100 },
    ] : []),
    { label: 'Income tax', amount: gross * percentage(values.income_tax_percent) / 100 },
    { label: 'Labour cess', amount: gross * percentage(values.labour_cess_percent) / 100 },
    { label: 'Culture Cess', amount: gross * percentage(values.construction_cess_percent) / 100 },
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
    workAfterEscalationAdjustment,
    workAfterPriceAdjustment: workAfterEscalationAdjustment,
    cultureCess,
    totalBeforeRebate,
    rebateBase,
    rebate,
    amountAfterRebate,
    escalationAdjustment,
    additionalEscalationAdjustment,
    totalAdjustments,
    totalAfterPriceAdjustment,
    previousBillAmount,
    gross,
    deductions,
    totalDeduction,
    netPayable: Math.max(0, gross - totalDeduction),
  };
}
