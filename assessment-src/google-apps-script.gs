const SHEET_NAME = 'Assessment Results';

function doPost(e) {
  const payload = JSON.parse(e.postData.contents);
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheetByName(SHEET_NAME) || spreadsheet.insertSheet(SHEET_NAME);
  const headers = [
    'Submitted At', 'Submission ID', 'Nickname', 'Age', 'AI Frequency', 'AI Tools',
    'Experiences', 'Creative Score', 'Communicator Score', 'AI Integrator Score',
    'Explorer Score', 'Core Strength', 'Supporting Strength', 'Next Skill', 'Creative Scenarios',
    'Provided Problems', 'Child Solutions', 'Notes', 'Answer Details'
  ];
  if (sheet.getLastRow() === 0) sheet.appendRow(headers);

  const codes = sheet.getLastRow() > 1
    ? sheet.getRange(2, 2, sheet.getLastRow() - 1, 1).getValues().flat()
    : [];
  if (codes.includes(payload.participantCode)) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, reason: 'duplicate_code' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  sheet.appendRow([
    payload.submittedAt, payload.participantCode, payload.nickname, payload.age,
    payload.aiFrequency, payload.aiTools.join(', '), payload.experiences.join(', '),
    payload.scores.creative, payload.scores.communicator, payload.scores.integrator,
    payload.scores.explorer, payload.coreStrength, payload.supportingStrength,
    payload.nextSkill, payload.scenario, payload.challengeProblem,
    payload.challengeSolution, payload.challengeDifference,
    JSON.stringify(payload.answers)
  ]);

  return ContentService.createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
