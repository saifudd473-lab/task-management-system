
/***************************************************************
 * TASK MANAGEMENT SYSTEM
 * BOSS + DOER
 *
 * MAIN SHEETS:
 * 1. BOSS
 * 2. DOER_LIST
 * 3. MASTER
 *
 * NO TASK_LIST ACCESS
 *
 * FEATURES:
 * - Email first login
 * - BOSS -> password second step
 * - BOSS password from Column C
 * - DOER -> email only
 * - Last email remembered in browser
 * - Secure BOSS session token
 * - Dashboard
 * - Employee filter
 * - From / To date filter
 * - Manual task assignment
 * - Bulk CSV upload
 * - Automatic Task IDs T001, T002...
 * - Start / Done / Blocked
 * - Completion photo mandatory
 * - Completed task locked
 * - BOSS due-date extension
 * - Extension count
 * - Delayed tracking
 * - Extended tracking
 * - Daily / Weekly / Monthly / Custom reports
 * - CSV report download
 ***************************************************************/


/***************************************************************
 * CONFIG
 ***************************************************************/
const CONFIG = {
  // Google Sheet ID yahan paste karo.
  // Example: 1AbCdEfGhIjKlMnOpQrStUvWxYz
  SPREADSHEET_ID: '1t4H4zRScr1AgFmAGIxMhFPRzxLCrDLGmBJ8K2jSaOs8',
  PHOTO_FOLDER_ID: '',

  // GitHub raw URL of Index.html.
  // Example:
  // https://raw.githubusercontent.com/USERNAME/task-management-system/main/Index.html
  GITHUB_INDEX_URL: '',

  SHEETS: {
    BOSS: 'BOSS',
    DOER_LIST: 'DOER_LIST',
    MASTER: 'MASTER'
  },

  SESSION_HOURS: 6
};


/***************************************************************
 * WEB APP
 ***************************************************************/
function doGet() {

  // GitHub se latest Index.html load hoga.
  // GitHub repository PUBLIC honi chahiye agar raw URL use kar rahe ho.
  const url = String(CONFIG.GITHUB_INDEX_URL || '').trim();

  if (url) {
    try {
      const response = UrlFetchApp.fetch(url, {
        muteHttpExceptions: true,
        followRedirects: true
      });

      const code = response.getResponseCode();

      if (code === 200) {
        return HtmlService
          .createHtmlOutput(response.getContentText())
          .setTitle('Task Management System')
          .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
      }

      throw new Error('GitHub Index.html HTTP ' + code);

    } catch (error) {
      // GitHub fail ho to local Index.html fallback.
      try {
        return HtmlService
          .createHtmlOutputFromFile('Index')
          .setTitle('Task Management System')
          .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
      } catch (fallbackError) {
        throw new Error('Frontend load failed: ' + error.message);
      }
    }
  }

  // Agar GitHub URL abhi set nahi kiya hai to local Index.html chalega.
  return HtmlService
    .createHtmlOutputFromFile('Index')
    .setTitle('Task Management System')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}


/***************************************************************
 * SPREADSHEET
 ***************************************************************/
function getSpreadsheet() {

  if (
    CONFIG.SPREADSHEET_ID &&
    String(CONFIG.SPREADSHEET_ID).trim() !== ''
  ) {
    return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  }

  return SpreadsheetApp.getActiveSpreadsheet();
}


/***************************************************************
 * SHEET
 ***************************************************************/
function getSheet(sheetName) {

  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    throw new Error('Sheet "' + sheetName + '" nahi mili.');
  }

  return sheet;
}


/***************************************************************
 * NORMALIZE
 ***************************************************************/
function normalizeEmail(email) {
  return String(email || '')
    .trim()
    .toLowerCase();
}


function normalizeText(value) {
  return String(value || '').trim();
}


function normalizeStatus(value) {
  return String(value || '')
    .trim()
    .toUpperCase();
}


/***************************************************************
 * HEADER MAP
 ***************************************************************/
function getColumns(headers) {

  const map = {};

  headers.forEach(function(header, index) {

    const rawKey = String(header || '')
      .trim()
      .toUpperCase();

    const key = rawKey
      .replace(/[\s\-]+/g, '_')
      .replace(/_+/g, '_');

    if (key) {
      map[key] = index;
    }

    if (rawKey && map[rawKey] === undefined) {
      map[rawKey] = index;
    }
  });

  return {
    INSTANCE_ID: map.INSTANCE_ID !== undefined ? map.INSTANCE_ID : -1,
    TASK_ID: map.TASK_ID !== undefined ? map.TASK_ID : -1,
    TASK_NAME: map.TASK_NAME !== undefined ? map.TASK_NAME : -1,
    CATEGORY: map.CATEGORY !== undefined ? map.CATEGORY : -1,
    DESCRIPTION: map.DESCRIPTION !== undefined ? map.DESCRIPTION : -1,
    PRIORITY: map.PRIORITY !== undefined ? map.PRIORITY : -1,
    DOER_EMAIL: map.DOER_EMAIL !== undefined ? map.DOER_EMAIL : -1,
    DOER_NAME: map.DOER_NAME !== undefined ? map.DOER_NAME : -1,
    ASSIGNED_BY: map.ASSIGNED_BY !== undefined ? map.ASSIGNED_BY : -1,
    ASSIGNED_DATE: map.ASSIGNED_DATE !== undefined ? map.ASSIGNED_DATE : -1,
    DUE_DATE: map.DUE_DATE !== undefined ? map.DUE_DATE : -1,
    STATUS: map.STATUS !== undefined ? map.STATUS : -1,
    COMPLETED_DATE: map.COMPLETED_DATE !== undefined ? map.COMPLETED_DATE : -1,
    COMPLETED_BY: map.COMPLETED_BY !== undefined ? map.COMPLETED_BY : -1,
    REMARKS: map.REMARKS !== undefined ? map.REMARKS : -1,
    PHOTO_URL: map.PHOTO_URL !== undefined ? map.PHOTO_URL : -1,
    EXTENSION_COUNT: map.EXTENSION_COUNT !== undefined
      ? map.EXTENSION_COUNT
      : -1
  };
}


/***************************************************************
 * SAFE VALUE
 ***************************************************************/
function getValue(row, index) {

  if (
    index === -1 ||
    index === undefined ||
    index === null
  ) {
    return '';
  }

  return row[index];
}


/***************************************************************
 * SET VALUE IF COLUMN EXISTS
 ***************************************************************/
function setIfExists(row, index, value) {

  if (index !== -1 && index !== undefined) {
    row[index] = value;
  }
}


/***************************************************************
 * ACTIVE VALUE
 ***************************************************************/
function isActiveValue(value) {

  if (
    value === '' ||
    value === null ||
    value === undefined
  ) {
    return true;
  }

  const text = String(value)
    .trim()
    .toUpperCase();

  return (
    text === 'TRUE' ||
    text === 'YES' ||
    text === 'ACTIVE' ||
    text === '1'
  );
}


/***************************************************************
 * BOSS LOGIN
 *
 * STEP 1:
 * email only
 *
 * STEP 2:
 * if BOSS email found -> password required
 *
 * PASSWORD:
 * BOSS sheet Column C
 ***************************************************************/
function loginUser(email, password) {

  email = normalizeEmail(email);

  if (!email) {
    return {
      success: false,
      message: 'Email required hai.'
    };
  }


  /*************************************************************
   * 1. BOSS CHECK FIRST
   *************************************************************/
  const boss = checkBOSS(email);

  if (boss.found) {

    /***********************************************************
     * PASSWORD NOT PROVIDED
     ***********************************************************/
    if (password === undefined || password === null || password === '') {

      return {
        success: false,
        passwordRequired: true,
        role: 'BOSS',
        email: email,
        name: boss.name || '',
        message: 'Please enter BOSS password.'
      };
    }


    /***********************************************************
     * PASSWORD CHECK
     ***********************************************************/
    if (String(password) !== String(boss.password)) {

      return {
        success: false,
        passwordRequired: true,
        role: 'BOSS',
        email: email,
        name: boss.name || '',
        errorType: 'INVALID_PASSWORD',
        message: 'Invalid BOSS password.'
      };
    }


    /***********************************************************
     * CREATE SECURE SESSION
     ***********************************************************/
    const token = createBossSession(email);

    return {
      success: true,
      role: 'BOSS',
      email: email,
      name: boss.name || '',
      passwordRequired: true,
      sessionToken: token,
      message: 'BOSS access granted.'
    };
  }


  /*************************************************************
   * 2. DOER CHECK
   *************************************************************/
  const doer = checkDoer(email);

  if (doer.found) {

    return {
      success: true,
      role: 'DOER',
      email: email,
      name: doer.name || '',
      passwordRequired: false,
      message: 'DOER access granted.'
    };
  }


  /*************************************************************
   * 3. NOT REGISTERED
   *************************************************************/
  return {
    success: false,
    errorType: 'NOT_REGISTERED',
    message: 'EMAIL NOT REGISTERED'
  };
}


/***************************************************************
 * CHECK BOSS
 *
 * EMAIL:
 * header EMAIL preferred
 *
 * PASSWORD:
 * Column C is mandatory fallback/primary requirement.
 *
 * NAME:
 * optional NAME header
 *
 * ACTIVE:
 * optional ACTIVE header
 ***************************************************************/
function checkBOSS(email) {

  email = normalizeEmail(email);

  const sheet = getSheet(CONFIG.SHEETS.BOSS);

  const data = sheet
    .getDataRange()
    .getValues();

  if (data.length < 2) {
    return {
      found: false
    };
  }

  const headers = data[0];

  let emailCol = -1;
  let nameCol = -1;
  let activeCol = -1;
  let passwordCol = -1;


  headers.forEach(function(header, index) {

    const h = String(header || '')
      .trim()
      .toUpperCase();

    if (h === 'EMAIL') {
      emailCol = index;
    }

    if (h === 'NAME') {
      nameCol = index;
    }

    if (h === 'ACTIVE') {
      activeCol = index;
    }

    if (
      h === 'PASSWORD' ||
      h === 'PASS' ||
      h === 'BOSS_PASSWORD'
    ) {
      passwordCol = index;
    }
  });


  /*************************************************************
   * EMAIL MUST EXIST
   *************************************************************/
  if (emailCol === -1) {
    throw new Error(
      'BOSS sheet mein EMAIL column nahi hai.'
    );
  }


  /*************************************************************
   * USER SPECIFIED:
   * PASSWORD IS COLUMN C
   *
   * If PASSWORD header exists, use it.
   * Otherwise Column C = index 2.
   *************************************************************/
  if (passwordCol === -1) {
    passwordCol = 2;
  }


  for (let i = 1; i < data.length; i++) {

    const sheetEmail = normalizeEmail(
      data[i][emailCol]
    );

    if (sheetEmail !== email) {
      continue;
    }


    let active = true;

    if (activeCol !== -1) {
      active = isActiveValue(
        data[i][activeCol]
      );
    }

    if (!active) {
      return {
        found: false
      };
    }


    return {
      found: true,
      name: nameCol === -1
        ? ''
        : data[i][nameCol],

      password:
        passwordCol < data[i].length
          ? data[i][passwordCol]
          : ''
    };
  }


  return {
    found: false
  };
}


/***************************************************************
 * CHECK DOER
 ***************************************************************/
function checkDoer(email) {

  email = normalizeEmail(email);

  const sheet = getSheet(CONFIG.SHEETS.DOER_LIST);

  const data = sheet
    .getDataRange()
    .getValues();

  if (data.length < 2) {
    return {
      found: false
    };
  }

  const headers = data[0];

  const emailCol =
    headers.findIndex(function(h) {
      return String(h || '')
        .trim()
        .toUpperCase() === 'EMAIL';
    });

  const nameCol =
    headers.findIndex(function(h) {
      return String(h || '')
        .trim()
        .toUpperCase() === 'NAME';
    });

  const activeCol =
    headers.findIndex(function(h) {
      return String(h || '')
        .trim()
        .toUpperCase() === 'ACTIVE';
    });


  if (emailCol === -1) {
    throw new Error(
      'DOER_LIST mein EMAIL column nahi hai.'
    );
  }


  for (let i = 1; i < data.length; i++) {

    const sheetEmail = normalizeEmail(
      data[i][emailCol]
    );

    if (sheetEmail !== email) {
      continue;
    }


    let active = true;

    if (activeCol !== -1) {
      active = isActiveValue(
        data[i][activeCol]
      );
    }


    if (!active) {
      return {
        found: false
      };
    }


    return {
      found: true,
      name: nameCol === -1
        ? ''
        : data[i][nameCol]
    };
  }


  return {
    found: false
  };
}


/***************************************************************
 * BOSS SESSION
 ***************************************************************/
function createBossSession(email) {

  const token = Utilities.getUuid();

  const payload = JSON.stringify({
    email: normalizeEmail(email),
    createdAt: new Date().getTime()
  });

  CacheService
    .getScriptCache()
    .put(
      'BOSS_SESSION_' + token,
      payload,
      CONFIG.SESSION_HOURS * 60 * 60
    );

  return token;
}


/***************************************************************
 * VERIFY BOSS SESSION
 ***************************************************************/
function verifyBossSession(token) {

  if (!token) {
    throw new Error('BOSS session missing.');
  }

  const cacheKey =
    'BOSS_SESSION_' + String(token);

  const cached =
    CacheService
      .getScriptCache()
      .get(cacheKey);

  if (!cached) {
    throw new Error(
      'BOSS session expired. Please login again.'
    );
  }

  let session;

  try {
    session = JSON.parse(cached);
  } catch (e) {
    throw new Error(
      'Invalid BOSS session.'
    );
  }

  const boss = checkBOSS(session.email);

  if (!boss.found) {
    throw new Error(
      'BOSS account not found.'
    );
  }

  return {
    email: session.email,
    name: boss.name || ''
  };
}


/***************************************************************
 * LOGOUT BOSS
 ***************************************************************/
function logoutBoss(token) {

  if (!token) {
    return {
      success: true
    };
  }

  CacheService
    .getScriptCache()
    .remove(
      'BOSS_SESSION_' + String(token)
    );

  return {
    success: true,
    message: 'Logged out.'
  };
}


/***************************************************************
 * CREATE INSTANCE ID
 ***************************************************************/
function createInstanceId() {

  return (
    'INST-' +
    new Date().getTime() +
    '-' +
    Utilities.getUuid().substring(0, 8)
  );
}


/***************************************************************
 * TASK ID GENERATION
 *
 * T001
 * T002
 * T003
 * ...
 ***************************************************************/
function generateNextTaskIdsLocked(sheet, taskCount) {

  if (!taskCount || taskCount < 1) {
    return [];
  }

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  if (lastRow < 1 || lastCol < 1) {
    return [];
  }

  const data = sheet
    .getRange(
      1,
      1,
      lastRow,
      lastCol
    )
    .getValues();

  const headers = data[0];

  const taskIdCol =
    headers.findIndex(function(h) {
      return String(h || '')
        .trim()
        .toUpperCase() === 'TASK_ID';
    });

  if (taskIdCol === -1) {
    throw new Error(
      'MASTER mein TASK_ID column nahi hai.'
    );
  }


  let maxNumber = 0;

  for (let i = 1; i < data.length; i++) {

    const value =
      String(data[i][taskIdCol] || '')
        .trim()
        .toUpperCase();

    const match =
      value.match(/^T(\d+)$/);

    if (match) {

      const number =
        parseInt(match[1], 10);

      if (
        !isNaN(number) &&
        number > maxNumber
      ) {
        maxNumber = number;
      }
    }
  }


  const ids = [];

  for (let i = 1; i <= taskCount; i++) {

    maxNumber++;

    ids.push(
      'T' +
      String(maxNumber).padStart(3, '0')
    );
  }

  return ids;
}


/***************************************************************
 * DASHBOARD
 ***************************************************************/
function getBOSSDashboard(
  sessionToken,
  employeeName,
  fromDate,
  toDate
) {

  verifyBossSession(sessionToken);

  const dashboard = buildDashboard();

  return filterDashboard(
    dashboard,
    employeeName,
    fromDate,
    toDate
  );
}


/***************************************************************
 * BOSS EMPLOYEE SCORING
 *
 * Score = COMPLETED / TOTAL TASKS * 100
 * Filters are applied before scoring.
 ***************************************************************/
function buildEmployeeScores(tasks) {

  const map = {};

  tasks.forEach(function(task) {

    const name =
      normalizeText(task.doerName) ||
      normalizeText(task.doerEmail) ||
      'Unknown';

    if (!map[name]) {
      map[name] = {
        employee: name,
        email: normalizeEmail(task.doerEmail),
        total: 0,
        pending: 0,
        inProgress: 0,
        completed: 0,
        blocked: 0,
        delayed: 0,
        extended: 0,
        score: 0
      };
    }

    const item = map[name];

    item.total++;

    const status = normalizeStatus(task.status);

    if (status === 'PENDING') item.pending++;
    if (status === 'IN_PROGRESS') item.inProgress++;
    if (status === 'COMPLETED') item.completed++;
    if (status === 'BLOCKED') item.blocked++;

    if (task.delayed) item.delayed++;

    if (Number(task.extensionCount || 0) > 0) {
      item.extended++;
    }
  });

  const result = Object.keys(map).map(function(key) {

    const item = map[key];

    item.score =
      item.total > 0
        ? Math.round((item.completed / item.total) * 10000) / 100
        : 0;

    item.completionRate = item.score;

    return item;
  });

  result.sort(function(a, b) {
    if (b.score !== a.score) {
      return b.score - a.score;
    }

    return a.employee.localeCompare(b.employee);
  });

  return result;
}


/***************************************************************
 * BOSS EMPLOYEE REPORT
 *
 * Returns filtered task list + employee-wise scoring.
 ***************************************************************/
function getBOSEmployeeReport(
  sessionToken,
  employeeName,
  fromDate,
  toDate
) {

  verifyBossSession(sessionToken);

  const dashboard = filterDashboard(
    buildDashboard(),
    employeeName,
    fromDate,
    toDate
  );

  return {
    success: true,
    employee: employeeName || 'All Employees',
    fromDate: fromDate || '',
    toDate: toDate || '',
    summary: makeReportSummary(dashboard.tasks),
    employeeScores: dashboard.employeeScores || [],
    tasks: dashboard.tasks
  };
}


/***************************************************************
 * DOER DASHBOARD
 ***************************************************************/
function getDoerDashboard(email) {

  email = normalizeEmail(email);

  const doer = checkDoer(email);

  if (!doer.found) {
    throw new Error(
      'EMAIL NOT REGISTERED'
    );
  }

  const dashboard =
    buildDashboard();

  dashboard.tasks =
    dashboard.tasks.filter(function(task) {

      return normalizeEmail(
        task.doerEmail
      ) === email;
    });

  return recalculateDashboard(
    dashboard
  );
}


/***************************************************************
 * BUILD DASHBOARD
 ***************************************************************/
function buildDashboard() {

  const sheet =
    getSheet(CONFIG.SHEETS.MASTER);

  const data =
    sheet.getDataRange().getValues();

  let result = {
    total: 0,
    pending: 0,
    inProgress: 0,
    completed: 0,
    blocked: 0,
    delayed: 0,
    extended: 0,
    tasks: []
  };

  if (data.length < 2) {
    result.employeeScores = [];
    return result;
  }

  const headers = data[0];
  const col = getColumns(headers);

  // MASTER ki har non-empty task row dashboard me aayegi.
  // Legacy rows me INSTANCE_ID blank ho sakta hai, isliye
  // dashboard ke liye INSTANCE_ID mandatory nahi hai.
  for (let i = 1; i < data.length; i++) {

    const row = data[i];

    const hasAnyValue =
      row.some(function(value) {
        return String(
          value === null || value === undefined ? '' : value
        ).trim() !== '';
      });

    if (!hasAnyValue) {
      continue;
    }

    const task = rowToObject(row, col);

    if (!task.instanceId) {
      task.instanceId = 'MASTER_ROW_' + (i + 1);
      task.legacyRow = true;
    } else {
      task.legacyRow = false;
    }

    if (!task.status) {
      task.status = 'PENDING';
    }

    result.tasks.push(task);
  }

  result = recalculateDashboard(result);
  result.employeeScores = buildEmployeeScores(result.tasks);

  return result;
}


/***************************************************************
 * RECALCULATE COUNTS
 ***************************************************************/
function recalculateDashboard(data) {

  data.total = data.tasks.length;

  data.pending = 0;
  data.inProgress = 0;
  data.completed = 0;
  data.blocked = 0;
  data.delayed = 0;
  data.extended = 0;


  data.tasks.forEach(function(task) {

    const status =
      normalizeStatus(task.status);

    if (status === 'PENDING') {
      data.pending++;
    }

    if (status === 'IN_PROGRESS') {
      data.inProgress++;
    }

    if (status === 'COMPLETED') {
      data.completed++;
    }

    if (status === 'BLOCKED') {
      data.blocked++;
    }

    if (task.delayed) {
      data.delayed++;
    }

    if (
      Number(task.extensionCount || 0) > 0
    ) {
      data.extended++;
    }
  });


  return data;
}


/***************************************************************
 * FILTER DASHBOARD
 *
 * Employee Name
 * From Date
 * To Date
 *
 * ASSIGNED_DATE based
 ***************************************************************/
function filterDashboard(
  dashboard,
  employeeName,
  fromDate,
  toDate
) {

  const employee =
    normalizeText(employeeName);

  const range =
    normalizeDateRange(fromDate, toDate);

  dashboard.tasks =
    dashboard.tasks.filter(function(task) {

      if (
        employee &&
        normalizeText(task.doerName) !== employee
      ) {
        return false;
      }

      if (range.start || range.end) {

        const assigned =
          parseDateValue(task.rawAssignedDate);

        if (!assigned) {
          return false;
        }

        if (
          range.start &&
          assigned.getTime() < range.start.getTime()
        ) {
          return false;
        }

        if (
          range.end &&
          assigned.getTime() > range.end.getTime()
        ) {
          return false;
        }
      }

      return true;
    });

  dashboard =
    recalculateDashboard(dashboard);

  dashboard.employeeScores =
    buildEmployeeScores(dashboard.tasks);

  return dashboard;
}


/***************************************************************
 * DATE RANGE NORMALIZER
 *
 * Accepts:
 * YYYY-MM-DD
 * DD/MM/YYYY
 * Date objects
 *
 * To date is always inclusive until 23:59:59.999.
 ***************************************************************/
function normalizeDateRange(fromDate, toDate) {

  let start =
    parseFilterDate(fromDate);

  let end =
    parseFilterDate(toDate);

  if (start) {
    start.setHours(0, 0, 0, 0);
  }

  if (end) {
    end.setHours(23, 59, 59, 999);
  }

  if (start && end && start.getTime() > end.getTime()) {
    throw new Error(
      'From Date To Date se badi nahi ho sakti.'
    );
  }

  return {
    start: start,
    end: end
  };
}


/***************************************************************
 * GET ALL EMPLOYEES
 ***************************************************************/
function getAllEmployees(sessionToken) {

  verifyBossSession(sessionToken);

  const sheet =
    getSheet(CONFIG.SHEETS.DOER_LIST);

  const data =
    sheet.getDataRange().getValues();

  if (data.length < 2) {
    return [];
  }

  const headers = data[0];

  const col = {
    DOER_ID:
      headers.findIndex(h =>
        String(h || '').trim().toUpperCase() === 'DOER_ID'
      ),

    NAME:
      headers.findIndex(h =>
        String(h || '').trim().toUpperCase() === 'NAME'
      ),

    EMAIL:
      headers.findIndex(h =>
        String(h || '').trim().toUpperCase() === 'EMAIL'
      ),

    DEPARTMENT:
      headers.findIndex(h =>
        String(h || '').trim().toUpperCase() === 'DEPARTMENT'
      ),

    ROLE:
      headers.findIndex(h =>
        String(h || '').trim().toUpperCase() === 'ROLE'
      ),

    ACTIVE:
      headers.findIndex(h =>
        String(h || '').trim().toUpperCase() === 'ACTIVE'
      )
  };


  if (col.EMAIL === -1) {
    throw new Error(
      'DOER_LIST mein EMAIL column nahi hai.'
    );
  }


  const employees = [];


  for (let i = 1; i < data.length; i++) {

    const email =
      normalizeEmail(
        data[i][col.EMAIL]
      );

    if (!email) {
      continue;
    }


    if (
      col.ACTIVE !== -1 &&
      !isActiveValue(data[i][col.ACTIVE])
    ) {
      continue;
    }


    employees.push({

      doerId:
        col.DOER_ID === -1
          ? ''
          : data[i][col.DOER_ID],

      name:
        col.NAME === -1
          ? ''
          : data[i][col.NAME],

      email: email,

      department:
        col.DEPARTMENT === -1
          ? ''
          : data[i][col.DEPARTMENT],

      role:
        col.ROLE === -1
          ? 'DOER'
          : data[i][col.ROLE],

      active: true
    });
  }


  return employees;
}


/***************************************************************
 * ASSIGN TASK
 *
 * TASK_ID NEVER ACCEPTED FROM FRONTEND
 ***************************************************************/
function assignTask(taskData, sessionToken) {

  const boss =
    verifyBossSession(sessionToken);


  if (!taskData) {
    throw new Error(
      'Task data missing.'
    );
  }


  const taskName =
    normalizeText(taskData.taskName);

  const doerEmail =
    normalizeEmail(taskData.doerEmail);


  if (!taskName) {
    throw new Error(
      'Task name required hai.'
    );
  }


  if (!doerEmail) {
    throw new Error(
      'Employee select karo.'
    );
  }


  const doer =
    checkDoer(doerEmail);

  if (!doer.found) {
    throw new Error(
      'Employee DOER_LIST mein registered nahi hai.'
    );
  }


  const sheet =
    getSheet(CONFIG.SHEETS.MASTER);

  const headers =
    sheet
      .getRange(
        1,
        1,
        1,
        sheet.getLastColumn()
      )
      .getValues()[0];

  const col =
    getColumns(headers);


  if (col.TASK_ID === -1) {
    throw new Error(
      'MASTER mein TASK_ID column nahi hai.'
    );
  }


  const lock =
    LockService.getScriptLock();


  lock.waitLock(30000);


  try {

    /***********************************************************
     * AUTOMATIC TASK ID
     ***********************************************************/
    const taskIds =
      generateNextTaskIdsLocked(
        sheet,
        1
      );

    const taskId =
      taskIds[0];


    const row =
      new Array(headers.length)
        .fill('');


    setIfExists(
      row,
      col.INSTANCE_ID,
      createInstanceId()
    );


    setIfExists(
      row,
      col.TASK_ID,
      taskId
    );


    setIfExists(
      row,
      col.TASK_NAME,
      taskName
    );


    setIfExists(
      row,
      col.CATEGORY,
      normalizeText(taskData.category)
    );


    setIfExists(
      row,
      col.DESCRIPTION,
      normalizeText(taskData.description)
    );


    setIfExists(
      row,
      col.PRIORITY,
      normalizeText(taskData.priority) || 'MEDIUM'
    );


    setIfExists(
      row,
      col.DOER_EMAIL,
      doerEmail
    );


    setIfExists(
      row,
      col.DOER_NAME,
      doer.name || ''
    );


    setIfExists(
      row,
      col.ASSIGNED_BY,
      boss.email
    );


    setIfExists(
      row,
      col.ASSIGNED_DATE,
      new Date()
    );


    if (taskData.dueDate) {

      const due =
        parseFilterDate(taskData.dueDate);

      if (!due) {
        throw new Error(
          'Invalid due date.'
        );
      }

      setIfExists(
        row,
        col.DUE_DATE,
        due
      );
    }


    setIfExists(
      row,
      col.STATUS,
      'PENDING'
    );


    setIfExists(
      row,
      col.REMARKS,
      normalizeText(taskData.remarks)
    );


    setIfExists(
      row,
      col.EXTENSION_COUNT,
      0
    );


    sheet.appendRow(row);


    return {
      success: true,
      taskId: taskId,
      instanceId: row[col.INSTANCE_ID],
      message:
        'Task ' +
        taskId +
        ' successfully assign ho gaya.'
    };

  } finally {

    lock.releaseLock();
  }
}


/***************************************************************
 * BULK ASSIGN
 *
 * CSV TASK_ID WILL BE IGNORED
 ***************************************************************/
function bulkAssignTasks(rows, sessionToken) {

  const boss =
    verifyBossSession(sessionToken);


  if (
    !Array.isArray(rows) ||
    rows.length === 0
  ) {
    throw new Error(
      'CSV mein task data nahi mila.'
    );
  }


  const validRows = [];


  rows.forEach(function(taskData, index) {

    const taskName =
      normalizeText(taskData.taskName);

    const doerEmail =
      normalizeEmail(taskData.doerEmail);


    if (!taskName && !doerEmail) {
      return;
    }


    if (!taskName) {
      throw new Error(
        'Row ' +
        (index + 2) +
        ': TASK_NAME missing.'
      );
    }


    if (!doerEmail) {
      throw new Error(
        'Row ' +
        (index + 2) +
        ': DOER_EMAIL missing.'
      );
    }


    const doer =
      checkDoer(doerEmail);


    if (!doer.found) {
      throw new Error(
        'Row ' +
        (index + 2) +
        ': Employee registered nahi hai: ' +
        doerEmail
      );
    }


    let dueDate = '';

    if (taskData.dueDate) {

      dueDate =
        parseFilterDate(
          taskData.dueDate
        );

      if (!dueDate) {
        throw new Error(
          'Row ' +
          (index + 2) +
          ': Invalid DUE_DATE.'
        );
      }
    }


    validRows.push({
      source: taskData,
      taskName: taskName,
      doerEmail: doerEmail,
      doer: doer,
      dueDate: dueDate
    });
  });


  if (!validRows.length) {
    throw new Error(
      'Valid tasks nahi mile.'
    );
  }


  const sheet =
    getSheet(CONFIG.SHEETS.MASTER);

  const headers =
    sheet
      .getRange(
        1,
        1,
        1,
        sheet.getLastColumn()
      )
      .getValues()[0];

  const col =
    getColumns(headers);


  if (col.TASK_ID === -1) {
    throw new Error(
      'MASTER mein TASK_ID column nahi hai.'
    );
  }


  const lock =
    LockService.getScriptLock();

  lock.waitLock(30000);


  try {

    /***********************************************************
     * GENERATE ALL IDs TOGETHER
     ***********************************************************/
    const taskIds =
      generateNextTaskIdsLocked(
        sheet,
        validRows.length
      );


    const output = [];


    validRows.forEach(function(item, index) {

      const source =
        item.source;

      const row =
        new Array(headers.length)
          .fill('');


      setIfExists(
        row,
        col.INSTANCE_ID,
        createInstanceId()
      );


      /*********************************************************
       * IMPORTANT:
       * CSV TASK_ID NOT USED
       *********************************************************/
      setIfExists(
        row,
        col.TASK_ID,
        taskIds[index]
      );


      setIfExists(
        row,
        col.TASK_NAME,
        item.taskName
      );


      setIfExists(
        row,
        col.CATEGORY,
        normalizeText(source.category)
      );


      setIfExists(
        row,
        col.DESCRIPTION,
        normalizeText(source.description)
      );


      setIfExists(
        row,
        col.PRIORITY,
        normalizeText(source.priority) || 'MEDIUM'
      );


      setIfExists(
        row,
        col.DOER_EMAIL,
        item.doerEmail
      );


      setIfExists(
        row,
        col.DOER_NAME,
        item.doer.name || ''
      );


      setIfExists(
        row,
        col.ASSIGNED_BY,
        boss.email
      );


      setIfExists(
        row,
        col.ASSIGNED_DATE,
        new Date()
      );


      if (item.dueDate) {

        setIfExists(
          row,
          col.DUE_DATE,
          item.dueDate
        );
      }


      setIfExists(
        row,
        col.STATUS,
        'PENDING'
      );


      setIfExists(
        row,
        col.REMARKS,
        normalizeText(source.remarks)
      );


      setIfExists(
        row,
        col.EXTENSION_COUNT,
        0
      );


      output.push(row);
    });


    sheet
      .getRange(
        sheet.getLastRow() + 1,
        1,
        output.length,
        headers.length
      )
      .setValues(output);


    return {
      success: true,
      count: output.length,
      taskIds: taskIds,
      message:
        output.length +
        ' tasks successfully assign ho gaye.'
    };

  } finally {

    lock.releaseLock();
  }
}


/***************************************************************
 * UPDATE TASK STATUS
 *
 * DOER:
 * - own task only
 *
 * BOSS:
 * - any task
 *
 * COMPLETED:
 * - photo mandatory
 ***************************************************************/
function updateTaskStatus(
  instanceId,
  newStatus,
  remarks,
  userEmail,
  photoData
) {

  userEmail =
    normalizeEmail(userEmail);

  newStatus =
    normalizeStatus(newStatus);


  if (
    ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'BLOCKED']
      .indexOf(newStatus) === -1
  ) {
    throw new Error(
      'Invalid task status.'
    );
  }


  /*************************************************************
   * LOGIN / AUTH
   *************************************************************/
  const boss =
    checkBOSS(userEmail);

  const doer =
    checkDoer(userEmail);

  if (!boss.found && !doer.found) {
    throw new Error(
      'EMAIL NOT REGISTERED'
    );
  }


  const sheet =
    getSheet(CONFIG.SHEETS.MASTER);

  const data =
    sheet.getDataRange().getValues();


  if (data.length < 2) {
    throw new Error(
      'No tasks found.'
    );
  }


  const headers = data[0];
  const col = getColumns(headers);


  for (let i = 1; i < data.length; i++) {

    const row = data[i];

    const currentInstance =
      String(
        getValue(row, col.INSTANCE_ID)
      ).trim();

    const sheetRowNumber = i + 1;
    const legacyInstance =
      'MASTER_ROW_' + sheetRowNumber;

    const requestedInstance =
      String(instanceId).trim();

    if (
      currentInstance !== requestedInstance &&
      legacyInstance !== requestedInstance
    ) {
      continue;
    }


    const taskEmail =
      normalizeEmail(
        getValue(row, col.DOER_EMAIL)
      );


    /***********************************************************
     * DOER CAN UPDATE OWN TASK ONLY
     ***********************************************************/
    if (
      !boss.found &&
      doer.found &&
      taskEmail !== userEmail
    ) {
      throw new Error(
        'Aap is task ko update nahi kar sakte.'
      );
    }


    /***********************************************************
     * COMPLETED LOCK
     ***********************************************************/
    const oldStatus =
      normalizeStatus(
        getValue(row, col.STATUS)
      );


    if (oldStatus === 'COMPLETED') {
      throw new Error(
        'Completed task locked hai.'
      );
    }


    /***********************************************************
     * COMPLETION PHOTO REQUIRED
     ***********************************************************/
    if (
      newStatus === 'COMPLETED' &&
      (
        !photoData ||
        !photoData.data
      )
    ) {
      throw new Error(
        'Task Done karne ke liye photo upload karein.'
      );
    }


    /***********************************************************
     * UPDATE STATUS
     ***********************************************************/
    setSheetValue(
      sheet,
      i + 1,
      col.STATUS,
      newStatus
    );


    /***********************************************************
     * REMARKS
     ***********************************************************/
    if (col.REMARKS !== -1) {

      setSheetValue(
        sheet,
        i + 1,
        col.REMARKS,
        normalizeText(remarks)
      );
    }


    /***********************************************************
     * COMPLETED
     ***********************************************************/
    let photoUrl = '';


    if (newStatus === 'COMPLETED') {

      if (col.COMPLETED_DATE !== -1) {

        setSheetValue(
          sheet,
          i + 1,
          col.COMPLETED_DATE,
          new Date()
        );
      }


      if (col.COMPLETED_BY !== -1) {

        setSheetValue(
          sheet,
          i + 1,
          col.COMPLETED_BY,
          userEmail
        );
      }


      if (photoData && photoData.data) {

        photoUrl =
          savePhoto(
            photoData,
            instanceId
          );


        if (col.PHOTO_URL !== -1) {

          setSheetValue(
            sheet,
            i + 1,
            col.PHOTO_URL,
            photoUrl
          );
        }
      }
    }


    SpreadsheetApp.flush();


    return {
      success: true,
      status: newStatus,
      photoUrl: photoUrl,
      message:
        newStatus === 'COMPLETED'
          ? 'Task successfully completed.'
          : 'Task status updated.'
    };
  }


  throw new Error(
    'Task not found.'
  );
}


/***************************************************************
 * EXTEND TASK DATE
 *
 * BOSS ONLY
 *
 * Extension:
 * - due date changes
 * - extension count +1
 * - task becomes IN_PROGRESS
 ***************************************************************/
function extendTaskDate(
  instanceId,
  newDate,
  sessionToken
) {

  const boss =
    verifyBossSession(sessionToken);


  const parsedDate =
    parseFilterDate(newDate);


  if (!parsedDate) {
    throw new Error(
      'Invalid new due date.'
    );
  }


  const sheet =
    getSheet(CONFIG.SHEETS.MASTER);

  const data =
    sheet.getDataRange().getValues();


  if (data.length < 2) {
    throw new Error(
      'MASTER sheet mein koi task nahi hai.'
    );
  }


  const headers = data[0];
  const col = getColumns(headers);


  if (col.INSTANCE_ID === -1) {
    throw new Error(
      'INSTANCE_ID column nahi mili.'
    );
  }

  if (col.DUE_DATE === -1) {
    throw new Error(
      'DUE_DATE column nahi mili.'
    );
  }

  if (col.STATUS === -1) {
    throw new Error(
      'STATUS column nahi mili.'
    );
  }


  for (let i = 1; i < data.length; i++) {

    const currentId =
      String(
        getValue(data[i], col.INSTANCE_ID)
      ).trim();

    const sheetRowNumber = i + 1;
    const legacyInstance =
      'MASTER_ROW_' + sheetRowNumber;

    const requestedInstance =
      String(instanceId).trim();

    if (
      currentId !== requestedInstance &&
      legacyInstance !== requestedInstance
    ) {
      continue;
    }


    const oldStatus =
      normalizeStatus(
        getValue(data[i], col.STATUS)
      );


    if (oldStatus === 'COMPLETED') {
      throw new Error(
        'Completed task ki date extend nahi kar sakte.'
      );
    }


    setSheetValue(
      sheet,
      i + 1,
      col.DUE_DATE,
      parsedDate
    );


    setSheetValue(
      sheet,
      i + 1,
      col.STATUS,
      'IN_PROGRESS'
    );


    /***********************************************************
     * EXTENSION COUNT
     ***********************************************************/
    let extensionCount = 0;

    if (col.EXTENSION_COUNT !== -1) {

      extensionCount =
        Number(
          getValue(
            data[i],
            col.EXTENSION_COUNT
          ) || 0
        );

      if (isNaN(extensionCount)) {
        extensionCount = 0;
      }

      extensionCount++;

      setSheetValue(
        sheet,
        i + 1,
        col.EXTENSION_COUNT,
        extensionCount
      );
    }


    /***********************************************************
     * REMARKS
     ***********************************************************/
    if (col.REMARKS !== -1) {

      const oldRemarks =
        String(
          getValue(
            data[i],
            col.REMARKS
          ) || ''
        );


      const extensionRemark =
        'Due date extended by BOSS (' +
        boss.email +
        ') on ' +
        formatDate(
          new Date()
        ) +
        ' to ' +
        formatDate(
          parsedDate,
          false
        );


      setSheetValue(
        sheet,
        i + 1,
        col.REMARKS,
        oldRemarks
          ? oldRemarks + '\n' + extensionRemark
          : extensionRemark
      );
    }


    SpreadsheetApp.flush();


    return {
      success: true,
      status: 'IN_PROGRESS',
      extensionCount: extensionCount,
      dueDate:
        formatDate(
          parsedDate,
          false
        ),
      message:
        'Due date successfully extended.'
    };
  }


  throw new Error(
    'Task not found.'
  );
}


/***************************************************************
 * SAVE PHOTO
 ***************************************************************/
function savePhoto(photoData, instanceId) {

  let folder;


  if (
    CONFIG.PHOTO_FOLDER_ID &&
    String(CONFIG.PHOTO_FOLDER_ID).trim() !== ''
  ) {

    folder =
      DriveApp.getFolderById(
        CONFIG.PHOTO_FOLDER_ID
      );

  } else {

    const folders =
      DriveApp.getFoldersByName(
        'Task_Completion_Photos'
      );


    if (folders.hasNext()) {

      folder =
        folders.next();

    } else {

      folder =
        DriveApp.createFolder(
          'Task_Completion_Photos'
        );
    }
  }


  const mimeType =
    photoData.mimeType ||
    'image/jpeg';


  const bytes =
    Utilities.base64Decode(
      photoData.data
    );


  const extension =
    mimeType.indexOf('png') !== -1
      ? '.png'
      : '.jpg';


  const blob =
    Utilities.newBlob(
      bytes,
      mimeType,
      'Task_' +
      instanceId +
      '_' +
      new Date().getTime() +
      extension
    );


  const file =
    folder.createFile(blob);


  return file.getUrl();
}


/***************************************************************
 * REPORT
 ***************************************************************/
function getBOSSReport(
  sessionToken,
  period,
  employeeFilter,
  fromDate,
  toDate
) {

  verifyBossSession(sessionToken);

  const dashboard =
    buildDashboard();

  period =
    String(period || 'daily')
      .trim()
      .toLowerCase();

  let start = null;
  let end = null;

  const today =
    new Date();

  today.setHours(
    0,
    0,
    0,
    0
  );

  if (period === 'daily') {

    start = new Date(today);
    end = new Date(today);

    end.setHours(
      23,
      59,
      59,
      999
    );

  } else if (period === 'weekly') {

    start = new Date(today);

    const day =
      start.getDay();

    const diff =
      day === 0
        ? 6
        : day - 1;

    start.setDate(
      start.getDate() - diff
    );

    end = new Date(start);

    end.setDate(
      end.getDate() + 6
    );

    end.setHours(
      23,
      59,
      59,
      999
    );

  } else if (period === 'monthly') {

    start =
      new Date(
        today.getFullYear(),
        today.getMonth(),
        1
      );

    end =
      new Date(
        today.getFullYear(),
        today.getMonth() + 1,
        0
      );

    end.setHours(
      23,
      59,
      59,
      999
    );

  } else if (period === 'custom') {

    const range =
      normalizeDateRange(
        fromDate,
        toDate
      );

    start = range.start;
    end = range.end;

    if (!start || !end) {
      throw new Error(
        'Custom report ke liye From Date aur To Date dono required hain.'
      );
    }

  } else {

    // ALL = no date restriction
    start = null;
    end = null;
  }

  const employee =
    normalizeText(employeeFilter);

  let tasks =
    dashboard.tasks.filter(function(task) {

      if (
        employee &&
        normalizeText(task.doerName) !== employee
      ) {
        return false;
      }

      if (start || end) {

        const assigned =
          parseDateValue(
            task.rawAssignedDate
          );

        if (!assigned) {
          return false;
        }

        if (
          start &&
          assigned.getTime() <
          start.getTime()
        ) {
          return false;
        }

        if (
          end &&
          assigned.getTime() >
          end.getTime()
        ) {
          return false;
        }
      }

      return true;
    });

  const summary =
    makeReportSummary(tasks);

  const employeeScores =
    buildEmployeeScores(tasks);

  return {
    success: true,
    period: period,
    fromDate:
      start
        ? formatDate(start, false)
        : '',
    toDate:
      end
        ? formatDate(end, false)
        : '',
    employee:
      employee ||
      'All Employees',
    summary: summary,
    employeeScores: employeeScores,
    tasks: tasks
  };
}


/***************************************************************
 * REPORT SUMMARY
 ***************************************************************/
function makeReportSummary(tasks) {

  const summary = {
    total: tasks.length,
    pending: 0,
    inProgress: 0,
    completed: 0,
    blocked: 0,
    delayed: 0,
    extended: 0
  };


  tasks.forEach(function(task) {

    const status =
      normalizeStatus(task.status);


    if (status === 'PENDING') {
      summary.pending++;
    }

    if (status === 'IN_PROGRESS') {
      summary.inProgress++;
    }

    if (status === 'COMPLETED') {
      summary.completed++;
    }

    if (status === 'BLOCKED') {
      summary.blocked++;
    }

    if (task.delayed) {
      summary.delayed++;
    }

    if (
      Number(task.extensionCount || 0) > 0
    ) {
      summary.extended++;
    }
  });


  return summary;
}


/***************************************************************
 * REPORT DOWNLOAD DATA
 ***************************************************************/
function getReportDownloadData(
  sessionToken,
  period,
  employeeFilter,
  fromDate,
  toDate
) {

  const report =
    getBOSSReport(
      sessionToken,
      period,
      employeeFilter,
      fromDate,
      toDate
    );


  const rows = [];


  rows.push([
    'TASK_ID',
    'TASK_NAME',
    'CATEGORY',
    'DESCRIPTION',
    'PRIORITY',
    'DOER_EMAIL',
    'DOER_NAME',
    'ASSIGNED_BY',
    'ASSIGNED_DATE',
    'DUE_DATE',
    'STATUS',
    'COMPLETED_DATE',
    'COMPLETED_BY',
    'REMARKS',
    'PHOTO_URL',
    'EXTENSION_COUNT',
    'DELAYED'
  ]);


  report.tasks.forEach(function(task) {

    rows.push([
      task.taskId,
      task.taskName,
      task.category,
      task.description,
      task.priority,
      task.doerEmail,
      task.doerName,
      task.assignedBy,
      task.assignedDate,
      task.dueDate,
      task.status,
      task.completedDate,
      task.completedBy,
      task.remarks,
      task.photoUrl,
      task.extensionCount,
      task.delayed ? 'YES' : 'NO'
    ]);
  });


  // Employee-wise scoring section is appended below the task report.
  rows.push([]);
  rows.push([
    'EMPLOYEE SCORING',
    'EMAIL',
    'TOTAL TASKS',
    'PENDING',
    'IN_PROGRESS',
    'COMPLETED',
    'BLOCKED',
    'DELAYED',
    'EXTENDED',
    'SCORE %'
  ]);

  (report.employeeScores || []).forEach(function(item) {
    rows.push([
      item.employee,
      item.email,
      item.total,
      item.pending,
      item.inProgress,
      item.completed,
      item.blocked,
      item.delayed,
      item.extended,
      item.score
    ]);
  });

  return {
    success: true,
    filename:
      'Task_Report_' +
      new Date().getTime() +
      '.csv',
    csv:
      convertRowsToCsv(rows)
  };
}


/***************************************************************
 * CSV GENERATOR
 ***************************************************************/
function convertRowsToCsv(rows) {

  return rows
    .map(function(row) {

      return row
        .map(function(value) {

          let text =
            value === null ||
            value === undefined
              ? ''
              : String(value);

          text =
            text.replace(/"/g, '""');

          return '"' + text + '"';

        })
        .join(',');

    })
    .join('\r\n');
}


/***************************************************************
 * ROW -> OBJECT
 ***************************************************************/
function rowToObject(row, col) {

  const rawAssignedDate =
    getValue(
      row,
      col.ASSIGNED_DATE
    );


  const rawDueDate =
    getValue(
      row,
      col.DUE_DATE
    );


  const status =
    normalizeStatus(
      getValue(
        row,
        col.STATUS
      )
    ) || 'PENDING';


  const extensionCount =
    Number(
      getValue(
        row,
        col.EXTENSION_COUNT
      ) || 0
    );


  const task = {

    instanceId:
      getValue(
        row,
        col.INSTANCE_ID
      ),

    taskId:
      getValue(
        row,
        col.TASK_ID
      ),

    taskName:
      getValue(
        row,
        col.TASK_NAME
      ),

    category:
      getValue(
        row,
        col.CATEGORY
      ),

    description:
      getValue(
        row,
        col.DESCRIPTION
      ),

    priority:
      getValue(
        row,
        col.PRIORITY
      ),

    doerEmail:
      getValue(
        row,
        col.DOER_EMAIL
      ),

    doerName:
      getValue(
        row,
        col.DOER_NAME
      ),

    assignedBy:
      getValue(
        row,
        col.ASSIGNED_BY
      ),

    assignedDate:
      formatDate(
        rawAssignedDate,
        false
      ),

    rawAssignedDate:
      rawAssignedDate,

    dueDate:
      formatDate(
        rawDueDate,
        false
      ),

    rawDueDate:
      rawDueDate,

    status:
      status,

    completedDate:
      formatDate(
        getValue(
          row,
          col.COMPLETED_DATE
        ),
        false
      ),

    completedBy:
      getValue(
        row,
        col.COMPLETED_BY
      ),

    remarks:
      getValue(
        row,
        col.REMARKS
      ),

    photoUrl:
      getValue(
        row,
        col.PHOTO_URL
      ),

    extensionCount:
      isNaN(extensionCount)
        ? 0
        : extensionCount,

    delayed:
      isTaskDelayed(
        status,
        rawDueDate
      )
  };


  return task;
}


/***************************************************************
 * DELAYED CHECK
 *
 * Completed task is never delayed.
 ***************************************************************/
function isTaskDelayed(status, dueDate) {

  if (
    status === 'COMPLETED'
  ) {
    return false;
  }


  const due =
    parseDateValue(dueDate);


  if (!due) {
    return false;
  }


  const now =
    new Date();


  return due.getTime() <
    now.getTime();
}


/***************************************************************
 * DATE PARSER
 ***************************************************************/
function parseFilterDate(value) {

  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return null;
  }


  if (
    Object.prototype.toString.call(value) ===
    '[object Date]'
  ) {

    if (isNaN(value.getTime())) {
      return null;
    }

    const d =
      new Date(value);

    d.setHours(
      0,
      0,
      0,
      0
    );

    return d;
  }


  const text =
    String(value).trim();


  /***********************************************************
   * YYYY-MM-DD
   ***********************************************************/
  let match =
    text.match(
      /^(\d{4})-(\d{1,2})-(\d{1,2})$/
    );


  if (match) {

    const d =
      new Date(
        Number(match[1]),
        Number(match[2]) - 1,
        Number(match[3])
      );

    if (isNaN(d.getTime())) {
      return null;
    }

    d.setHours(
      0,
      0,
      0,
      0
    );

    return d;
  }


  /***********************************************************
   * DD/MM/YYYY
   ***********************************************************/
  match =
    text.match(
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/
    );


  if (match) {

    const d =
      new Date(
        Number(match[3]),
        Number(match[2]) - 1,
        Number(match[1])
      );

    if (isNaN(d.getTime())) {
      return null;
    }

    d.setHours(
      0,
      0,
      0,
      0
    );

    return d;
  }


  const d =
    new Date(text);


  if (isNaN(d.getTime())) {
    return null;
  }


  d.setHours(
    0,
    0,
    0,
    0
  );


  return d;
}


/***************************************************************
 * DATE VALUE PARSER
 ***************************************************************/
function parseDateValue(value) {

  if (!value) {
    return null;
  }

  if (Object.prototype.toString.call(value) === '[object Date]') {
    if (isNaN(value.getTime())) {
      return null;
    }
    return new Date(value);
  }

  const text = String(value).trim();

  let match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) {
    const d = new Date(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3])
    );
    return isNaN(d.getTime()) ? null : d;
  }

  match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) {
    const d = new Date(
      Number(match[3]),
      Number(match[2]) - 1,
      Number(match[1])
    );
    return isNaN(d.getTime()) ? null : d;
  }

  const d = new Date(value);
  if (isNaN(d.getTime())) {
    return null;
  }

  return d;
}


/***************************************************************
 * FORMAT DATE
 *
 * default:
 * dd-MMM-yyyy HH:mm
 *
 * withTime=false:
 * dd-MMM-yyyy
 ***************************************************************/
function formatDate(value, withTime) {

  if (!value) {
    return '';
  }


  const d =
    parseDateValue(value);


  if (!d) {
    return String(value);
  }


  const format =
    withTime === false
      ? 'dd-MMM-yyyy'
      : 'dd-MMM-yyyy HH:mm';


  return Utilities.formatDate(
    d,
    Session.getScriptTimeZone(),
    format
  );
}


/***************************************************************
 * SET SHEET VALUE
 ***************************************************************/
function setSheetValue(
  sheet,
  row,
  columnIndex,
  value
) {

  if (
    columnIndex === -1 ||
    columnIndex === undefined
  ) {
    return;
  }


  sheet
    .getRange(
      row,
      columnIndex + 1
    )
    .setValue(value);
}


/***************************************************************
 * MASTER DASHBOARD TEST
 ***************************************************************/
function testMasterDashboard() {

  const sheet = getSheet(CONFIG.SHEETS.MASTER);
  const data = sheet.getDataRange().getValues();
  const headers = data.length ? data[0] : [];
  const col = getColumns(headers);

  const taskRows = data.slice(1).filter(function(row) {
    return row.some(function(value) {
      return String(value === null || value === undefined ? '' : value).trim() !== '';
    });
  }).length;

  const result = {
    spreadsheet: getSpreadsheet().getName(),
    sheet: CONFIG.SHEETS.MASTER,
    rowsInMaster: Math.max(0, data.length - 1),
    nonEmptyTaskRows: taskRows,
    headers: headers,
    mappedColumns: col
  };

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}


/***************************************************************
 * SIMPLE TEST FUNCTION
 *
 * Run this manually once from Apps Script
 * to check MASTER/BOSS/DOER_LIST.
 ***************************************************************/
function testSystem() {

  const ss =
    getSpreadsheet();


  const result = {
    spreadsheet:
      ss.getName(),

    bossSheet:
      !!ss.getSheetByName(
        CONFIG.SHEETS.BOSS
      ),

    doerSheet:
      !!ss.getSheetByName(
        CONFIG.SHEETS.DOER_LIST
      ),

    masterSheet:
      !!ss.getSheetByName(
        CONFIG.SHEETS.MASTER
      )
  };


  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );


  return result;
}
