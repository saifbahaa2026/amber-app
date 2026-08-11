// storage-supabase.js
//
// بديل حقيقي لملف storage-polyfill.js — يخزن البيانات على Supabase
// (قاعدة بيانات Postgres سحابية، مجانية بدون بطاقة بنكية) بدل
// localStorage المحلي، بحيث كل الأجهزة (صاحب المولد والمدير) يشوفون
// نفس البيانات لحظياً.
//
// App.jsx ما يتغيّر أبداً — يستمر يتعامل بس مع window.storage.get/set/delete/list
// (نفس الواجهة القديمة بالضبط).

import { createClient } from '@supabase/supabase-js';

// إعدادات مشروعك بـ Supabase (من Supabase Dashboard → Settings → API)
const SUPABASE_URL = 'https://qrhvxjebrxbnklfuoidu.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_vKIcnR7YugTJ0e3Eb-hehA_zoKEwFUl';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// نخزن كل شي بجدول وحد اسمه amper_storage
// كل صف فيه: id (key + shared)، key، value، shared
const TABLE_NAME = 'amper_storage';

function rowId(key, shared) {
  return ${shared ? 'shared' : 'local'}__${key};
}

window.storage = {
  async get(key, shared = false) {
    try {
      const { data, error } = await supabase
        .from(TABLE_NAME)
        .select('value')
        .eq('id', rowId(key, shared))
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;
      return { key, value: data.value, shared: !!shared };
    } catch (e) {
      console.error('storage.get failed', e);
      return null;
    }
  },

  async set(key, value, shared = false) {
    try {
      const { error } = await supabase.from(TABLE_NAME).upsert({
        id: rowId(key, shared),
        key,
        value,
        shared: !!shared,
      });
      if (error) throw error;
      return { key, value, shared: !!shared };
    } catch (e) {
      console.error('storage.set failed', e);
      return null;
    }
  },

  async delete(key, shared = false) {
    try {
      const { error } = await supabase
        .from(TABLE_NAME)
        .delete()
        .eq('id', rowId(key, shared));
      if (error) throw error;
      return { key, deleted: true, shared: !!shared };
    } catch (e) {
      console.error('storage.delete failed', e);
      return null;
    }
  },

  async list(prefix = '', shared = false) {
    try {
      let query = supabase
        .from(TABLE_NAME)
        .select('key')
        .eq('shared', !!shared);

      if (prefix) {
        query = query.like('key', ${prefix}%);
      }

      const { data, error } = await query;
      if (error) throw error;

      const keys = (data || []).map((row) => row.key);
      return { keys, prefix, shared: !!shared };
    } catch (e) {
      console.error('storage.list failed', e);
      return null;
    }
  },
};
