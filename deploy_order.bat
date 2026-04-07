@echo off
cd /d "%USERPROFILE%\Desktop\woozoo-order"
git add .
git commit -m "update"
git push
echo.
echo 배포 완료!
pause
