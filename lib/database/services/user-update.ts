import { postgres } from '@/lib/database/supabase';

export async function userUpdate(
  payload: Array<{
    email: string;
    entry: string;
    confirm: string;
    birthday: string;
    tz: string;
  }>,
) {
  try {
    let count = 0;
    const promises: any[] = [];
    payload.forEach((load) => {
      const promise = postgres
        .from('user')
        .update({
          updated_at: new Date().toISOString(),
          entry_date: load.entry,
          confirm_date: load.confirm,
          birthday_date: load.birthday,
          tz: load.tz,
        })
        .ilike('email', load.email.trim())
        .then((response) => {
          if (response.error) {
            console.error('Error updating user:', response.error);
          } else {
            count++;
          }
        });
      promises.push(promise);
    });

    await Promise.all(promises);

    console.log('Total', payload.length, 'lines.', 'Updated', count, 'users');
  } catch (error) {
    console.error('Error processing payload:', error);
  }
}
