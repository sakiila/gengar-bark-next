import { postToChannelId } from '@/lib/slack';
import { NextApiRequest, NextApiResponse } from 'next';

export const config = {
  maxDuration: 30,
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      response_type: 'ephemeral',
      text: 'Not allowed',
    });
  }

  const response = await fetchFn(
    `wiki/rest/api/content/${process.env.CF_TEMPLATEPAGEID}/copy`,
    {
      body: JSON.stringify({
        destination: {
          type: 'parent_page',
          value: process.env.CF_PARENTPAGEID,
        },
        copyAttachments: false,
        copyPermissions: false,
        copyProperties: false,
        copyLabels: false,
        copyCustomContents: false,
        pageTitle: `${formatTime()} Weekly Meetings`,
      }),
      method: 'POST',
    },
  );

  if (response.status !== 200) {
    return res.status(500).json({
      response_type: 'ephemeral',
      text: 'Failed to copy page',
    });
  }

  const jsonResponse = await response.json();

  try {
    await postToChannelId(
      'C070M3QGJTV',
      res,
      `填周报啦！请大家在这里填写本周的工作总结：<${jsonResponse._links.base}${jsonResponse._links.webui}|周报地址>`,
    );
  } catch (e) {
    console.log(e);
  }
}

async function todayIsHoliday() {
  const dateString = new Date().toISOString().split('T')[0];
  const url = `https://api.haoshenqi.top/holiday?date=${dateString}`;

  try {
    const response = await fetch(url);

    const data = await response.json();

    console.log('data:', data);

    return data[0].status == 1 || data[0].status == 3;
  } catch (error) {
    console.error('Fetch error:', error);
    return false;
  }
}

function convertUrl(url: string) {
  return /^\//.test(url) ? url : `/${url}`;
}

async function fetchFn(url: string, options: RequestInit = {}) {
  url = `https://${process.env.CF_DOMAIN}${convertUrl(url)}`;
  return await fetch(url, {
    method: 'GET',
    ...options,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: process.env.CF_TOKEN!,
      ...options.headers,
    },
  });
}

function formatTime(time = new Date()) {
  if (!time) {
    return '';
  }

  const year = time.getFullYear();
  const month = time.getMonth() + 1;
  const day = time.getDate();

  return `${year}-${`0${month}`.slice(-2)}-${`0${day}`.slice(-2)}`;
}
