import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://qrhvxjebrxbnklfuoidu.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_vKIcnR7YugTJ0e3Eb-hehA_zoKEwFUl';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const TABLE_NAME = 'amper_storage';

function rowId(key, shared) {
  var prefix = shared ? 'shared' : 'local';
  return prefix + '__' + key;
}

window.storage = {
  async get(key, shared) {
    shared = !!shared;
    try {
      const result = await supabase
        .from(TABLE_NAME)
        .select('value')
        .eq('id', rowId(key, shared))
        .maybeSingle();
      if (result.error) throw result.error;
      if (!result.data) return null;
      return { key: key, value: result.data.value, shared: shared };
    } catch (e) {
      console.error('storage.get failed', e);
      return null;
    }
  },
  async set(key, value, shared) {
    shared = !!shared;
    try {
      const result = await supabase.from(TABLE_NAME).upsert({
        id: rowId(key, shared),
        key: key,
        value: value,
        shared: shared
      });
      if (result.error) throw result.error;
      return { key: key, value: value, shared: shared };
    } catch (e) {
      console.error('storage.set failed', e);
      return null;
    }
  },
  async delete(key, shared) {
    shared = !!shared;
    try {
      const result = await supabase
        .from(TABLE_NAME)
        .delete()
        .eq('id', rowId(key, shared));
      if (result.error) throw result.error;
      return { key: key, deleted: true, shared: shared };
    } catch (e) {
      console.error('storage.delete failed', e);
      return null;
    }
  },
  async list(prefix, shared) {
    prefix = prefix || '';
    shared = !!shared;
    try {
      let query = supabase
        .from(TABLE_NAME)
        .select('key')
        .eq('shared', shared);
      if (prefix) {
        query = query.like('key', prefix + '%');
      }
      const result = await query;
      if (result.error) throw result.error;
      const keys = (result.data || []).map(function (row) { return row.key; });
      return { keys: keys, prefix: prefix, shared: shared };
    } catch (e) {
      console.error('storage.list failed', e);
      return null;
    }
  }
};
