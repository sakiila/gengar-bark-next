import { NextApiRequest, NextApiResponse } from 'next';
import { autoMessageReminderTask } from '@/lib/auto_message_reminder_task';
import { user_update } from '@/lib/user_update';

export const config = {
  maxDuration: 30,
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const payload = req.body as Array<{
    email: string;
    entry: string;
    confirm: string;
    birthday: string;
    tz: string;
  }>;

  console.log('/hr/excel_update payload = ', JSON.stringify(payload));

  // payload.forEach((load) => {
  //   console.log('load = ', JSON.stringify(load));
  // });

  await user_update(payload);

  return res.status(200).json({ message: 'Update successful!' });
}

/**
 * online file: https://docs.google.com/spreadsheets/d/1KBp8Q_maLw3MlV_Uup0xOYfJwfB03ZdZH7K-uFgkl_A/edit?gid=0#gid=0
 * online code: https://script.google.com/u/1/home/projects/1AcIZOA05HHiaae4PzaqBr2x7HiI9YhzcW6i2uwtVg-D_xAnZd1tLl2rt/edit
 */


// function excel_update() {
//   var ss = SpreadsheetApp.getActiveSpreadsheet();
//   var cn = ss.getSheets()[0];
//   var us= ss.getSheets()[1];
//   // Logger.log('Name 0: ' + cn.getName());
//   // Logger.log('Name 1: ' + us.getName());
//
//   var allData = [];
//   var data = cn.getDataRange().getValues();
//   for (var i = 1; i < data.length; i++) {
//     if (!data[i][0].toString().includes("moego.pet")) {
//       continue;
//     }
//     var rowData = {
//       'email': data[i][0],
//       'entry': Utilities.formatDate(data[i][1], "GMT+8", "yyyy-MM-dd"),
//       'confirm': Utilities.formatDate(data[i][2],"GMT+8","yyyy-MM-dd"),
//       'birthday': Utilities.formatDate(data[i][3],"GMT+8","yyyy-MM-dd"),
//       'tz': 'Asia/Chongqing',
//     };
//     allData.push(rowData);
//     // Logger.log('email: ' + data[i][0]);
//     // Logger.log('entry:' + Utilities.formatDate(data[i][1], "GMT+8", "yyyy-MM-dd"))
//   }
//
//   data = us.getDataRange().getValues();
//   for (var i = 1; i < data.length; i++) {
//     if (!data[i][0].toString().includes("moego.pet")) {
//       continue;
//     }
//     var rowData = {
//       'email': data[i][0],
//       'entry': Utilities.formatDate(data[i][1], "GMT+8","yyyy-MM-dd"),
//       'birthday': Utilities.formatDate(data[i][2],"GMT+8", "yyyy-MM-dd"),
//       'tz': 'America/Los_Angeles',
//     };
//     allData.push(rowData);
//     // Logger.log('email: ' + data[i][0]);
//     // Logger.log('entry:' + Utilities.formatDate(data[i][1], "GMT+8", "yyyy-MM-dd"))
//   }
//
//   // Make a POST request with a JSON payload
//   var options = {
//     'method' : 'post',
//     'contentType': 'application/json',
//     'payload' : JSON.stringify(allData)
//   };
//   UrlFetchApp.fetch('https://gengar-bark-next.vercel.app/api/hr/excel_update', options);
// }
