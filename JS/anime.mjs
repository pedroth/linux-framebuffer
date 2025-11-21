import fs from 'node:fs';

const MAX_BYTE = 255;
const framebufferPath = '/dev/fb0';

function getFrameBufferSize(devicePath = '/sys/class/graphics/fb0/virtual_size') {
    try {
        console.log(`Reading framebuffer size from SysFS at ${devicePath}`);
        const data = fs.readFileSync(devicePath, 'utf8').trim();
        // The format is typically "WIDTHxHEIGHT\n" (e.g., "1920x1080")
        const [width, height] = data.split(',').map(Number);

        if (width && height) {
            console.log(`FrameBuffer Size (SysFS): ${width}x${height} pixels`);
            return { width, height };
        }
    } catch (error) {
        console.error(`Error reading framebuffer size from SysFS: ${error.message}`);
        // This file might not exist on all Linux systems or configurations.
    }
    return null;
}


const Screen = () => {
    const ans = {};
    const size = getFrameBufferSize();
    console.log(`Using framebuffer size: ${size ? `${size.width}x${size.height}` : 'default 2560x1440'}`);
    ans.width = size ? size.width : 2560;
    ans.height = size ? size.height : 1440;
    ans.bytesPerPixel = 4;
    ans.channels = 4;
    ans.size = ans.width * ans.height * ans.bytesPerPixel;
    ans.buffer = Buffer.allocUnsafe(ans.size);
    ans.fb = fs.openSync(framebufferPath, 'r+');
    ans.map = (lambda, time) => {
        const channels = ans.bytesPerPixel;
        const w = ans.width;
        const h = ans.height;
        for (let k = 0; k < ans.size; k += channels) {
            const i = k / (channels * w);
            const j = (k / channels) % w;
            const x = j;
            const y = h - 1 - i;
            const color = lambda(x, y, time);
            if (!color) continue;
            ans.buffer[k] = MAX_BYTE * color[2];
            ans.buffer[k + 1] = MAX_BYTE * color[1];
            ans.buffer[k + 2] = MAX_BYTE * color[0];
            ans.buffer[k + 3] = MAX_BYTE;
        }
        return ans.paint();
    }
    ans.paint = () => {
        fs.writeSync(ans.fb, ans.buffer, 0, ans.size, 0);
        return ans;
    }
    return ans;
}

const screen = Screen();
const render = (x, y, t) => {
    const px = (x * t) / screen.width;
    const py = (y * t) / screen.height;
    return [px % 1, py % 1, 0];
}

const play = ({ oldTime, time }) => {
    const newTime = new Date().getTime();
    const dt = (newTime - oldTime) * 1e-3;
    screen.map(render, time);
    if (time > 10) return;
    setTimeout(() => play({ oldTime: newTime, time: time + dt }));
}
play({ oldTime: new Date().getTime(), time: 0 });