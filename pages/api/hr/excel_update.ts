import { NextApiRequest, NextApiResponse } from 'next';
import { userUpdate } from '@/lib/database/services/user-update';

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
    country: string;
  }>;

  // console.log('/hr/excel_update payload = ', JSON.stringify(payload));

  // payload.forEach((load) => {
  //   console.log('load = ', JSON.stringify(load));
  // });

  await userUpdate(payload);

  return res.status(200).json({ message: 'Update successful!' });
}

/**
 * online file: https://docs.google.com/spreadsheets/d/1KBp8Q_maLw3MlV_Uup0xOYfJwfB03ZdZH7K-uFgkl_A/edit?gid=0#gid=0
 * online code: https://script.google.com/u/1/home/projects/1AcIZOA05HHiaae4PzaqBr2x7HiI9YhzcW6i2uwtVg-D_xAnZd1tLl2rt/edit
 */

/*
function excel_update() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var cn = ss.getSheets()[0];
  var us= ss.getSheets()[1];
  // Logger.log('Name 0: ' + cn.getName());
  // Logger.log('Name 1: ' + us.getName());

  var allData = [];
  var data = cn.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (!data[i][0].toString().includes("moego.pet")) {
      continue;
    }
    var rowData = {
      'email': data[i][0],
      'entry': getDate(data[i][1]),
      'confirm': getDate(data[i][2]),
      'birthday': getDate(data[i][3]),
      'tz': 'Asia/Chongqing',
      'country': 'CN',
    };
    allData.push(rowData);
    // Logger.log('email: ' + rowData.email);
    // Logger.log('entry: ' + rowData.entry);
    // Logger.log('birthday:' + rowData.birthday);
  }

  data = us.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (!data[i][0].toString().includes("moego.pet")) {
      continue;
    }
    var rowData = {
      'email': data[i][0],
      'entry': getDate(data[i][1]),
      'birthday': getDate(data[i][2]),
      'tz': 'America/Los_Angeles',
      'country': 'US',
    };
    allData.push(rowData);
    // Logger.log('email: ' + rowData.email);
    // Logger.log('entry: ' + rowData.entry);
    // Logger.log('birthday:' + rowData.birthday);
  }

  // Make a POST request with a JSON payload
  var options = {
    'method' : 'post',
    'contentType': 'application/json',
    'payload' : JSON.stringify(allData)
  };
  UrlFetchApp.fetch('https://pearl.baobo.me/api/hr/excel_update', options);
}

function getDate(cellValue) {
  // Logger.log('cellValue:[' + cellValue + ']');

  if (isEmpty(cellValue)) return null;

  try {
    let dateValue;

    if (typeof cellValue === 'string') {
      // Standardize the date string first
      const standardizedDate = standardizeDate(cellValue);
      if (!standardizedDate) return null;

      // Parse the standardized date string
      dateValue = new Date(standardizedDate);
    } else {
      // If it's already a Date object, use it directly
      dateValue = cellValue;
    }

    // Check if the date is valid
    if (isNaN(dateValue.getTime())) return null;

    return Utilities.formatDate(dateValue, "GMT+8", "yyyy-MM-dd");
  } catch (e) {
    Logger.log('Error processing date: ' + e);
    return null;
  }
}

function isEmpty(cellValue) {
  return cellValue === "" || cellValue === null || cellValue.toString().trim() === "";
}

function standardizeDate(dateStr) {
  if (isEmpty(dateStr)) return null;

  // Split the date string into components
  const parts = dateStr.split('/');
  if (parts.length !== 3) return null;

  // Pad month and day with leading zeros if needed
  const year = parts[0];
  const month = parts[1].padStart(2, '0');
  const day = parts[2].padStart(2, '0');

  return `${year}/${month}/${day}`;
}
*/
