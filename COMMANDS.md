# Project Commands Reference

## Development Server

### Start the app
```bash
cd my-app
npm start
```
- Runs on `http://localhost:3000`
- Auto-opens browser
- Hot reload enabled

### Stop the development server
**Option 1: Press in terminal**
- Press `Ctrl + C` (or `Cmd + C` on Mac) in the terminal where `npm start` is running

**Option 2: Kill the process**
```bash
# Find the process
ps aux | grep "react-scripts start" | grep -v grep

# Kill by PID (replace 13730 with actual PID)
kill 13730

# Or kill all node processes (be careful!)
pkill -f "react-scripts start"
```

**Option 3: Kill on port 3000**
```bash
# Find what's using port 3000
lsof -ti:3000

# Kill it
kill -9 $(lsof -ti:3000)
```

## Package Management

### Install dependencies
```bash
cd my-app
npm install
```

### Install specific packages
```bash
cd my-app
npm install @supabase/supabase-js antd react-router-dom dayjs
npm install @ant-design/icons
```

### Update packages
```bash
cd my-app
npm update
```

### Check for vulnerabilities
```bash
cd my-app
npm audit
npm audit fix
```

## Build & Deploy

### Create production build
```bash
cd my-app
npm run build
```
- Creates optimized build in `build/` folder

### Test the production build locally
```bash
cd my-app
npx serve -s build
```

### Run tests
```bash
cd my-app
npm test
```

## Environment Variables

### Check .env file
```bash
cd my-app
cat .env
```

### Edit .env file
```bash
cd my-app
nano .env
# or
code .env
```

## Git Commands

### Check status
```bash
git status
```

### Add changes
```bash
git add .
git add my-app/.env  # Add specific file
```

### Commit
```bash
git commit -m "Your message"
```

### Push
```bash
git push
```

## Supabase

### Check Supabase connection
- Open browser console (F12)
- Check for any Supabase errors
- Test authentication in the app

## Useful Development Commands

### Clear npm cache
```bash
npm cache clean --force
```

### Check Node version
```bash
node --version
npm --version
```

### List installed packages
```bash
cd my-app
npm list --depth=0
```

### Check for outdated packages
```bash
cd my-app
npm outdated
```

## Quick Start Checklist

1. **Navigate to project**
   ```bash
   cd /Users/kw/hackMIT2025/Temp-Hack-MIT/my-app
   ```

2. **Install dependencies** (if needed)
   ```bash
   npm install
   ```

3. **Verify .env file exists**
   ```bash
   cat .env
   ```

4. **Start development server**
   ```bash
   npm start
   ```

5. **Stop server when done**
   - Press `Ctrl + C` in terminal

## Troubleshooting

### Port 3000 already in use
```bash
# Kill process on port 3000
kill -9 $(lsof -ti:3000)
# Then restart
npm start
```

### Clear and reinstall
```bash
cd my-app
rm -rf node_modules package-lock.json
npm install
```

### Reset React app
```bash
cd my-app
rm -rf node_modules
npm install
npm start
```


