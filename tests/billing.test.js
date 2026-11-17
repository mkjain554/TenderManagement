import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateBill } from '../src/utils/billing.js';

test('calculates rebate, price adjustment, and previous bill deduction in sequence', () => {
  const result = calculateBill({
    work_done_amount: '1000',
    culture_cess_percent: '1',
    rebate_percent: '2',
    rebate_include_escalation: 'Include',
    escalation_type: 'Add',
    escalation_amount: '50',
    escalation_adjustment_type: 'Deduct',
    escalation_adjustment_amount: '30',
    previous_bill_amount: '200',
  }, false);

  assert.equal(result.workAfterPriceAdjustment, 1050);
  assert.equal(result.cultureCess, 10.5);
  assert.equal(result.totalBeforeRebate, 1060.5);
  assert.equal(result.rebateBase, 1060.5);
  assert.equal(result.rebate, 21.21);
  assert.equal(result.amountAfterRebate, 1039.29);
  assert.equal(result.escalationAdjustment, 50);
  assert.equal(result.additionalEscalationAdjustment, -30);
  assert.equal(result.totalAfterPriceAdjustment, 1009.29);
  assert.equal(result.totalAdjustments, 20);
  assert.equal(result.previousBillAmount, 200);
  assert.equal(result.gross, 809.29);
});

test('calculates culture cess on adjusted work and supports excluding escalation from the rebate base', () => {
  const result = calculateBill({
    work_done_amount: '1000',
    escalation_type: 'Add',
    escalation_amount: '100',
    culture_cess_percent: '5',
    rebate_percent: '2',
    rebate_include_escalation: 'Exclude',
    escalation_adjustment_type: 'Add',
    escalation_adjustment_amount: '20',
    previous_bill_amount: '200',
  }, false);

  assert.equal(result.workAfterEscalationAdjustment, 1100);
  assert.equal(result.cultureCess, 55);
  assert.equal(result.totalBeforeRebate, 1155);
  assert.equal(result.rebateBase, 1055);
  assert.equal(result.rebate, 21.1);
  assert.equal(result.amountAfterRebate, 1133.9);
  assert.equal(result.totalAdjustments, 120);
  assert.equal(Number(result.gross.toFixed(2)), 953.9);
});

test('deducts a price adjustment and never produces a negative gross amount', () => {
  const result = calculateBill({
    work_done_amount: '100',
    culture_cess_percent: '0',
    rebate_percent: '0',
    escalation_type: 'Deduct',
    escalation_amount: '10',
    escalation_adjustment_type: 'Add',
    escalation_adjustment_amount: '5',
    previous_bill_amount: '200',
  }, false);

  assert.equal(result.escalationAdjustment, -10);
  assert.equal(result.additionalEscalationAdjustment, 5);
  assert.equal(result.gross, 0);
});
