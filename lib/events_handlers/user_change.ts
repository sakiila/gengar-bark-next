import { NextApiRequest, NextApiResponse } from 'next';
import { postToProd } from '@/lib/slack';
import { postgres } from '@/lib/supabase';

export default async function user_change(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const user = req.body.event.user;

  try {
    const realName = user.profile.real_name_normalized;
    const email = user.profile.email;
    const id = user.id;
    const isBot = user.is_bot;
    const deleted = user.deleted;
    const teamId = user.team_id;
    const tz = user.tz;

    const { data: dbUser, error } = await postgres
      .from('user')
      .select('*')
      .eq('user_id', id);

    const userLeft =
      !isBot &&
      deleted &&
      (!dbUser || dbUser.length === 0 || dbUser[0].deleted === false);
    // const userJoinAgain =
    //   !isBot &&
    //   !deleted &&
    //   (!dbUser || dbUser.length === 0 || dbUser[0].deleted === true);

    await postgres.from('user').upsert(
      {
        user_id: id,
        deleted: deleted,
        email: email,
        real_name_normalized: realName,
        updated_at: new Date().toISOString(),
        tz: tz ?? dbUser?.[0].tz ?? 'Asia/Chongqing',
        is_bot: isBot,
        team_id: teamId,
      },
      { onConflict: 'user_id' },
    );

    if (userLeft) {
      const text = `:smiling_face_with_tear: ${realName} (<@${id}>) has left MoeGo team.`;
      await postToProd(res, text);
    }
    // else if (userJoinAgain) {
    //   const text = `:tada: <@${id}> (${realName}) has joined MoeGo AGAIN!`;
    //   await postToProd(res, text);
    // }
    else {
      res
        .status(200)
        .send(
          `user_change ${realName} (<@${id}>) not deleted or not changed, no need to notify.`,
        );
    }
  } catch (e) {
    console.log(e);
  }
}

/*
{
    "token":"s1l9rKtyoP53J9uSjAp0C8am",
    "team_id":"T011CF3CMJN",
    "api_app_id":"A06697P9VTN",
    "event":{
        "user":{
            "id":"U04LS7S30B0",
            "team_id":"T011CF3CMJN",
            "name":"channy",
            "deleted":true,
            "profile":{
                "title":"BE-Lyft",
                "phone":"18126186732",
                "skype":"",
                "real_name":"Channy.Shu",
                "real_name_normalized":"Channy.Shu",
                "display_name":"Channy",
                "display_name_normalized":"Channy",
                "fields":{
                    "Xf047GE9R9HD":{
                        "value":"[{\"type\":\"rich_text\",\"block_id\":\"rEL7\",\"elements\":[{\"type\":\"rich_text_section\",\"elements\":[{\"type\":\"text\",\"text\":\"BE engineer\"}]}]}]",
                        "alt":""
                    },
                    "Xf03KGTV17UK":{
                        "value":"18126186732",
                        "alt":""
                    },
                    "Xf03UVN6KGTG":{
                        "value":"BE-Lyft",
                        "alt":""
                    }
                },
                "status_text":"",
                "status_emoji":"",
                "status_emoji_display_info":[

                ],
                "status_expiration":0,
                "avatar_hash":"49c5ba32d552",
                "image_original":"https://avatars.slack-edge.com/2023-01-28/4698524488247_49c5ba32d55253d778a4_original.jpg",
                "is_custom_image":true,
                "email":"channy@moego.pet",
                "huddle_state":"default_unset",
                "huddle_state_expiration_ts":0,
                "first_name":"Channy.Shu",
                "last_name":"",
                "image_24":"https://avatars.slack-edge.com/2023-01-28/4698524488247_49c5ba32d55253d778a4_24.jpg",
                "image_32":"https://avatars.slack-edge.com/2023-01-28/4698524488247_49c5ba32d55253d778a4_32.jpg",
                "image_48":"https://avatars.slack-edge.com/2023-01-28/4698524488247_49c5ba32d55253d778a4_48.jpg",
                "image_72":"https://avatars.slack-edge.com/2023-01-28/4698524488247_49c5ba32d55253d778a4_72.jpg",
                "image_192":"https://avatars.slack-edge.com/2023-01-28/4698524488247_49c5ba32d55253d778a4_192.jpg",
                "image_512":"https://avatars.slack-edge.com/2023-01-28/4698524488247_49c5ba32d55253d778a4_512.jpg",
                "image_1024":"https://avatars.slack-edge.com/2023-01-28/4698524488247_49c5ba32d55253d778a4_1024.jpg",
                "status_text_canonical":"",
                "team":"T011CF3CMJN"
            },
            "is_bot":false,
            "is_app_user":false,
            "updated":1706697510
        },
        "cache_ts":1706697510,
        "type":"user_status_changed",
        "event_ts":"1706697510.077200"
    },
    "type":"event_callback",
    "event_id":"Ev06GFRJ9ZDZ",
    "event_time":1706697510,
    "authorizations":[
        {
            "enterprise_id":null,
            "team_id":"T011CF3CMJN",
            "user_id":"U0666R94C83",
            "is_bot":true,
            "is_enterprise_install":false
        }
    ],
    "is_ext_shared_channel":false
}
 */
