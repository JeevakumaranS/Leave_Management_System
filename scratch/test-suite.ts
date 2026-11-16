import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

const http = axios.create({ validateStatus: () => true });

async function runTestSuite() {
  const envFile = path.resolve(__dirname, '../frontend/.env.local');
  if (fs.existsSync(envFile)) {
    process.loadEnvFile(envFile);
  }
  const BASE_URL = process.env.NEXT_PUBLIC_API_URL;
  if (!BASE_URL) {
    throw new Error('NEXT_PUBLIC_API_URL must be configured to run the test suite.');
  }
  console.log('--- STARTING SRS TEST SUITE VERIFICATION ---');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testId: string, desc: string) {
    if (condition) {
      console.log(`[PASS] ${testId}: ${desc}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testId}: ${desc}`);
      failed++;
    }
  }

  try {
    // TC-01: Employee login
    const loginRes = await http(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ identifier: 'EMP-101', password: 'Password@123' }),
    });
    const loginData: any = loginRes.data;
    assert(loginRes.status === 201 || loginRes.status === 200 && !!loginData.accessToken, 'TC-01', 'Employee login successful with token');
    const empToken = loginData.accessToken;

    // TC-02: Invalid login
    const invalidRes = await http(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ identifier: 'EMP-101', password: 'WrongPassword' }),
    });
    assert(invalidRes.status === 401, 'TC-02', 'Invalid login rejected with 401 Unauthorized');

    // Director login
    const dirLogin = await http(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ identifier: 'director@example.test', password: 'Password@123' }),
    });
    const dirData: any = dirLogin.data;
    const dirToken = dirData.accessToken;

    // HR login
    const hrLogin = await http(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ identifier: 'hr@example.test', password: 'Password@123' }),
    });
    const hrData: any = hrLogin.data;
    const hrToken = hrData.accessToken;

    // TC-03: Add new employee (by HR)
    const testEmpId = `EMP-TEST-${Date.now().toString().slice(-4)}`;
    const addRes = await http(`${BASE_URL}/employees`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${hrToken}` },
      data: JSON.stringify({
        employeeId: testEmpId,
        name: 'Automated Test Employee',
        email: `test.${Date.now()}@example.test`,
        department: 'Engineering',
        designation: 'Test Engineer',
        status: 'ACTIVE',
      }),
    });
    const addData: any = addRes.data;
    assert(addRes.status === 201 && addData.employeeId === testEmpId, 'TC-03', 'Add new employee by HR');

    // TC-04: New employee appears in active dropdown
    const activeRes = await http(`${BASE_URL}/employees/active`);
    const activeList: any = activeRes.data;
    assert(activeList.some((e: any) => e.employeeId === testEmpId), 'TC-04', 'New employee appears in active dropdown list');

    // TC-07: End date before start date blocked (BR-05)
    const invalidDateRes = await http(`${BASE_URL}/leaves`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${empToken}` },
      data: JSON.stringify({
        employeeId: 'EMP-101',
        employeeName: 'Sarah Jenkins',
        employeeEmail: 'sarah.jenkins@example.test',
        managerEmail: 'director@example.test',
        leaveType: 'CASUAL_LEAVE',
        startDate: '2026-12-15',
        endDate: '2026-12-10', // End < Start
        duration: 'FULL_DAY',
        reason: 'Testing date rule',
      }),
    });
    assert(invalidDateRes.status === 400, 'TC-07', 'End date before start date rejected with 400 (BR-05)');

    // TC-08: Half-day across multiple dates blocked (BR-06)
    const invalidHalfDayRes = await http(`${BASE_URL}/leaves`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${empToken}` },
      data: JSON.stringify({
        employeeId: 'EMP-101',
        employeeName: 'Sarah Jenkins',
        employeeEmail: 'sarah.jenkins@example.test',
        managerEmail: 'director@example.test',
        leaveType: 'CASUAL_LEAVE',
        startDate: '2026-12-15',
        endDate: '2026-12-17', // Multiple dates with half day
        duration: 'HALF_DAY_FIRST_HALF',
        reason: 'Testing half day rule',
      }),
    });
    assert(invalidHalfDayRes.status === 400, 'TC-08', 'Half-day across multiple dates rejected with 400 (BR-06)');

    // TC-09: Other selected without note blocked (BR-08)
    const invalidOtherRes = await http(`${BASE_URL}/leaves`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${empToken}` },
      data: JSON.stringify({
        employeeId: 'EMP-101',
        employeeName: 'Sarah Jenkins',
        employeeEmail: 'sarah.jenkins@example.test',
        managerEmail: 'director@example.test',
        leaveType: 'OTHER',
        // otherNote omitted
        startDate: '2026-12-20',
        endDate: '2026-12-20',
        duration: 'FULL_DAY',
        reason: 'Testing other note rule',
      }),
    });
    assert(invalidOtherRes.status === 400, 'TC-09', 'Other leave selected without note rejected with 400 (BR-08)');

    // TC-19: Deactivated employee cannot submit (BR-04)
    const inactiveEmpLogin = await http(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ identifier: 'EMP-105', password: 'Password@123' }),
    });
    assert(inactiveEmpLogin.status === 401, 'TC-19', 'Deactivated employee login and application access blocked (BR-04, TC-19)');

    // TC-05 & TC-10: Submit valid leave form
    const submitLeaveRes = await http(`${BASE_URL}/leaves`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${empToken}` },
      data: JSON.stringify({
        employeeId: 'EMP-101',
        employeeName: 'Sarah Jenkins',
        employeeEmail: 'sarah.jenkins@example.test',
        managerEmail: 'director@example.test',
        leaveType: 'CASUAL_LEAVE',
        startDate: '2026-12-28',
        endDate: '2026-12-29',
        duration: 'FULL_DAY',
        reason: 'Year-end holiday travel with family.',
      }),
    });
    const submitData: any = submitLeaveRes.data;
    assert(submitLeaveRes.status === 201 && submitData.status === 'PENDING', 'TC-05', 'Submit complete leave form creates PENDING leave with unique ID');

    // Verify tokens were generated for both Director and HR
    const leaveDetail = await http(`${BASE_URL}/leaves/${submitData.requestId}`, {
      headers: { Authorization: `Bearer ${dirToken}` },
    });
    const leaveDetailData: any = leaveDetail.data;
    const dirTokenObj = leaveDetailData.tokens?.find((t: any) => t.approverId === 'DIR-001');
    const hrTokenObj = leaveDetailData.tokens?.find((t: any) => t.approverId === 'HR-001');
    assert(!!dirTokenObj && !!hrTokenObj, 'TC-10', 'Both Director and HR receive approval tokens and notifications');

    const unauthenticatedDecisionRes = await http(`${BASE_URL}/approvals/verify-token?token=${encodeURIComponent(dirTokenObj.tokenHash)}`);
    assert(unauthenticatedDecisionRes.status === 401, 'TC-10A', 'Email decision details require an authenticated account');

    const wrongApproverRes = await http(`${BASE_URL}/approvals/verify-token?token=${encodeURIComponent(hrTokenObj.tokenHash)}`, {
      headers: { Authorization: `Bearer ${dirToken}` },
    });
    assert(wrongApproverRes.status === 403, 'TC-10B', 'Only the account assigned to an email token can view request details');

    const verifyRes = await http(`${BASE_URL}/approvals/verify-token?token=${encodeURIComponent(dirTokenObj.tokenHash)}`, {
      headers: { Authorization: `Bearer ${dirToken}` },
    });
    assert(verifyRes.status === 200, 'TC-10C', 'The assigned Director account can view email decision details');

    const unauthenticatedSubmitRes = await http(`${BASE_URL}/approvals/decide-with-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ token: dirTokenObj.tokenHash, action: 'APPROVE' }),
    });
    assert(unauthenticatedSubmitRes.status === 401, 'TC-10D', 'Email decision submission requires an authenticated account');

    const wrongAccountDecisionRes = await http(`${BASE_URL}/approvals/decide-with-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${dirToken}` },
      data: JSON.stringify({
        token: hrTokenObj.tokenHash,
        action: 'REJECT',
        rejectionRemarks: 'Unauthorized account test',
      }),
    });
    assert(wrongAccountDecisionRes.status === 403, 'TC-10E', 'A different approver account cannot submit this email decision');

    // TC-11: Director approves using token
    const decideRes = await http(`${BASE_URL}/approvals/decide-with-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${dirToken}` },
      data: JSON.stringify({
        token: dirTokenObj.tokenHash,
        action: 'APPROVE',
      }),
    });
    const decideData: any = decideRes.data;
    assert(decideRes.status === 201 && decideData.status === 'APPROVED', 'TC-11', 'Director approves using token, status becomes APPROVED');

    // TC-13: Second approver (HR) clicks old link -> Action rejected ("Already Decided")
    const secondClickRes = await http(`${BASE_URL}/approvals/decide-with-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${hrToken}` },
      data: JSON.stringify({
        token: hrTokenObj.tokenHash,
        action: 'REJECT',
        rejectionRemarks: 'Attempting conflicting decision',
      }),
    });
    assert(secondClickRes.status === 400 || secondClickRes.status === 409, 'TC-13', 'Second approver decision link rejected (Atomic first decision final BR-11, BR-12)');

    // TC-17: Reuse approval token -> Action rejected
    const reuseTokenRes = await http(`${BASE_URL}/approvals/decide-with-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${dirToken}` },
      data: JSON.stringify({
        token: dirTokenObj.tokenHash,
        action: 'APPROVE',
      }),
    });
    assert(reuseTokenRes.status === 400, 'TC-17', 'Reuse approval token rejected (Token one-time usage TC-17)');

    // TC-14 & TC-15: Employee notification and portal status check
    const notifRes = await http(`${BASE_URL}/notifications?requestId=${submitData.requestId}`, {
      headers: { Authorization: `Bearer ${dirToken}` },
    });
    const notifData: any = notifRes.data;
    assert(notifData.some((n: any) => n.notificationType === 'APPROVAL'), 'TC-14', 'Employee approval notification email dispatched and logged');

    // TC-16: Unauthorized approval attempt (employee trying to decide leave)
    const unauthorizedRes = await http(`${BASE_URL}/approvals/portal-decide/${submitData.requestId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${empToken}` },
      data: JSON.stringify({ action: 'APPROVE' }),
    });
    assert(unauthorizedRes.status === 403, 'TC-16', 'Regular employee unauthorized approval attempt rejected with 403 Forbidden');

    console.log(`--- TEST RESULTS: ${passed} PASSED, ${failed} FAILED ---`);
  } catch (err: any) {
    console.error('Test Suite Error:', err);
  }
}

runTestSuite();
