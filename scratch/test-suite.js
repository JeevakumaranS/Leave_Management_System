async function runTestSuite() {
  const BASE_URL = 'http://localhost:4000/api';
  console.log('=== STARTING DUROZEN SRS ACCEPTANCE TEST SUITE ===');

  let passed = 0;
  let failed = 0;

  function assert(condition, testId, desc) {
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
    const loginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'EMP-101', password: 'Password@123' }),
    });
    const loginData = await loginRes.json();
    assert(loginRes.status === 200 || loginRes.status === 201 && !!loginData.accessToken, 'TC-01', 'Employee login successful with token');
    const empToken = loginData.accessToken;

    // TC-02: Invalid login
    const invalidRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'EMP-101', password: 'WrongPassword' }),
    });
    assert(invalidRes.status === 401, 'TC-02', 'Invalid login rejected with 401 Unauthorized');

    // Director login
    const dirLogin = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'director@durozen.in', password: 'Password@123' }),
    });
    const dirData = await dirLogin.json();
    const dirToken = dirData.accessToken;

    // HR login
    const hrLogin = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'hr@durozen.in', password: 'Password@123' }),
    });
    const hrData = await hrLogin.json();
    const hrToken = hrData.accessToken;

    // TC-03: Add new employee (by HR)
    const testEmpId = `EMP-TEST-${Date.now().toString().slice(-4)}`;
    const addRes = await fetch(`${BASE_URL}/employees`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${hrToken}` },
      body: JSON.stringify({
        employeeId: testEmpId,
        name: 'Automated Test Employee',
        email: `test.${Date.now()}@durozen.in`,
        department: 'Engineering',
        designation: 'Test Engineer',
        status: 'ACTIVE',
      }),
    });
    const addData = await addRes.json();
    assert(addRes.status === 201 && addData.employeeId === testEmpId, 'TC-03', 'Add new employee by HR');

    // TC-04: New employee appears in active dropdown
    const activeRes = await fetch(`${BASE_URL}/employees/active`);
    const activeList = await activeRes.json();
    assert(activeList.some((e) => e.employeeId === testEmpId), 'TC-04', 'New employee appears in active dropdown list');

    // TC-07: End date before start date blocked (BR-05)
    const invalidDateRes = await fetch(`${BASE_URL}/leaves`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${empToken}` },
      body: JSON.stringify({
        employeeId: 'EMP-101',
        employeeName: 'Sarah Jenkins',
        employeeEmail: 'sarah.jenkins@durozen.in',
        managerEmail: 'director@durozen.in',
        leaveType: 'CASUAL_LEAVE',
        startDate: '2026-12-15',
        endDate: '2026-12-10', // End < Start
        duration: 'FULL_DAY',
        reason: 'Testing date rule',
      }),
    });
    assert(invalidDateRes.status === 400, 'TC-07', 'End date before start date rejected with 400 (BR-05)');

    // TC-08: Half-day across multiple dates blocked (BR-06)
    const invalidHalfDayRes = await fetch(`${BASE_URL}/leaves`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${empToken}` },
      body: JSON.stringify({
        employeeId: 'EMP-101',
        employeeName: 'Sarah Jenkins',
        employeeEmail: 'sarah.jenkins@durozen.in',
        managerEmail: 'director@durozen.in',
        leaveType: 'CASUAL_LEAVE',
        startDate: '2026-12-15',
        endDate: '2026-12-17', // Multiple dates with half day
        duration: 'HALF_DAY_FIRST_HALF',
        reason: 'Testing half day rule',
      }),
    });
    assert(invalidHalfDayRes.status === 400, 'TC-08', 'Half-day across multiple dates rejected with 400 (BR-06)');

    // TC-09: Other selected without note blocked (BR-08)
    const invalidOtherRes = await fetch(`${BASE_URL}/leaves`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${empToken}` },
      body: JSON.stringify({
        employeeId: 'EMP-101',
        employeeName: 'Sarah Jenkins',
        employeeEmail: 'sarah.jenkins@durozen.in',
        managerEmail: 'director@durozen.in',
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
    const inactiveEmpLogin = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'EMP-105', password: 'Password@123' }),
    });
    assert(inactiveEmpLogin.status === 401, 'TC-19', 'Deactivated employee login and application access blocked (BR-04, TC-19)');

    // TC-05 & TC-10: Submit valid leave form (using dynamic future dates to prevent overlap collisions across multiple test runs)
    const futureDays = Math.floor(Math.random() * 500) + 30;
    const sDate = new Date(Date.now() + futureDays * 86400000).toISOString().split('T')[0];
    const eDate = new Date(Date.now() + (futureDays + 1) * 86400000).toISOString().split('T')[0];

    const submitLeaveRes = await fetch(`${BASE_URL}/leaves`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${empToken}` },
      body: JSON.stringify({
        employeeId: 'EMP-101',
        employeeName: 'Sarah Jenkins',
        employeeEmail: 'sarah.jenkins@durozen.in',
        managerEmail: 'director@durozen.in',
        leaveType: 'CASUAL_LEAVE',
        startDate: sDate,
        endDate: eDate,
        duration: 'FULL_DAY',
        reason: 'Year-end holiday travel with family.',
      }),
    });
    const submitData = await submitLeaveRes.json();
    assert(submitLeaveRes.status === 201 && submitData.status === 'PENDING', 'TC-05', 'Submit complete leave form creates PENDING leave with unique ID');

    // Verify tokens were generated for both Director and HR
    const leaveDetail = await fetch(`${BASE_URL}/leaves/${submitData.requestId}`, {
      headers: { Authorization: `Bearer ${dirToken}` },
    });
    const leaveDetailData = await leaveDetail.json();
    const dirTokenObj = leaveDetailData.tokens?.find((t) => t.approverId === 'DIR-001');
    const hrTokenObj = leaveDetailData.tokens?.find((t) => t.approverId === 'HR-001');
    assert(!!dirTokenObj && !!hrTokenObj, 'TC-10', 'Both Director and HR receive approval tokens and notifications');

    // TC-11: Director approves using token
    const decideRes = await fetch(`${BASE_URL}/approvals/decide-with-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: dirTokenObj.tokenHash,
        action: 'APPROVE',
      }),
    });
    const decideData = await decideRes.json();
    assert(decideRes.status === 201 && decideData.status === 'APPROVED', 'TC-11', 'Director approves using token, status becomes APPROVED');

    // TC-13: Second approver (HR) clicks old link -> Action rejected ("Already Decided")
    const secondClickRes = await fetch(`${BASE_URL}/approvals/decide-with-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: hrTokenObj.tokenHash,
        action: 'REJECT',
        rejectionRemarks: 'Attempting conflicting decision',
      }),
    });
    assert(secondClickRes.status === 400 || secondClickRes.status === 409, 'TC-13', 'Second approver decision link rejected (Atomic first decision final BR-11, BR-12)');

    // TC-17: Reuse approval token -> Action rejected
    const reuseTokenRes = await fetch(`${BASE_URL}/approvals/decide-with-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: dirTokenObj.tokenHash,
        action: 'APPROVE',
      }),
    });
    assert(reuseTokenRes.status === 400, 'TC-17', 'Reuse approval token rejected (Token one-time usage TC-17)');

    // TC-14 & TC-15: Employee notification and portal status check
    const notifRes = await fetch(`${BASE_URL}/notifications?requestId=${submitData.requestId}`, {
      headers: { Authorization: `Bearer ${dirToken}` },
    });
    const notifData = await notifRes.json();
    assert(notifData.some((n) => n.notificationType === 'APPROVAL'), 'TC-14', 'Employee approval notification email dispatched and logged');

    // TC-16: Unauthorized approval attempt (employee trying to decide leave)
    const unauthorizedRes = await fetch(`${BASE_URL}/approvals/portal-decide/${submitData.requestId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${empToken}` },
      body: JSON.stringify({ action: 'APPROVE' }),
    });
    assert(unauthorizedRes.status === 403, 'TC-16', 'Regular employee unauthorized approval attempt rejected with 403 Forbidden');

    console.log(`=== TEST SUMMARY: ${passed} PASSED, ${failed} FAILED ===`);
  } catch (err) {
    console.error('Test Suite Error:', err);
  }
}

runTestSuite();
