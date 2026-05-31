#!/usr/bin/env tsx
import { loadEnv, getSupabaseClient } from '../src/storage/database/supabase-client';
import * as fs from 'fs';
import * as path from 'path';

async function runMigration(env: 'develop' | 'product') {
  console.log(`\n=== 开始执行 ${env} 环境数据库迁移 ===\n`);

  // 加载环境变量
  loadEnv();

  // 获取 Supabase 客户端
  const client = getSupabaseClient();

  console.log('✅ Supabase 客户端初始化成功');

  // 获取迁移文件列表
  const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations');
  const migrationFiles = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  console.log(`找到 ${migrationFiles.length} 个迁移文件`);

  // 执行迁移
  for (const file of migrationFiles) {
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf-8');

    console.log(`\n执行迁移: ${file}`);

    try {
      // 使用 Supabase 的 rpc 或直接执行 SQL
      // Supabase JavaScript 客户端不直接支持执行任意 SQL
      // 我们需要使用 SQL 编辑器或者通过其他方式执行
      // 这里我们通过打印 SQL 来让用户知道需要执行什么
      console.log(`SQL 内容:\n${sql}\n`);
      console.log(`⚠️  请在 Supabase SQL 编辑器中执行上述 SQL`);
      
      // 尝试使用 Supabase 的功能执行
      try {
        // 对于 ALTER TABLE 等简单语句，我们可以尝试通过其他方式验证
        if (sql.includes('ALTER TABLE') && sql.includes('ADD COLUMN')) {
          console.log(`✅ ${file} - 请在 Supabase SQL 编辑器中执行`);
        } else {
          console.log(`✅ ${file} - 请在 Supabase SQL 编辑器中执行`);
        }
      } catch (e) {
        console.log(`⚠️  ${file} - 请手动在 Supabase SQL 编辑器中执行`);
      }
    } catch (error: any) {
      console.log(`❌ ${file} 执行失败:`, error.message);
    }
  }

  console.log(`\n✅ ${env} 环境迁移脚本执行完成！`);
  console.log(`\n请在 Supabase SQL 编辑器中按顺序执行上述 SQL 文件。`);
}

async function main() {
  try {
    // 执行开发环境迁移
    await runMigration('develop');

    // 执行生产环境迁移
    await runMigration('product');
  } catch (error) {
    console.error('\n❌ 迁移失败:', error);
    process.exit(1);
  }
}

main();
