import axios from 'axios';

async function run() {
  const API = 'http://localhost:3005/api';
  const admin = { email: 'admin@marz.my', password: 'admin123' };
  const login = await axios.post(`${API}/auth/login`, admin);
  const token = login.data.data.accessToken;
  const headers = { Authorization: `Bearer ${token}` };

  console.log('Queue a WhatsApp message...');
  const enqueue = await axios.post(`${API}/wasapmatic/send`, {
    to: '+60123456789',
    message: 'Ujian penghantaran melalui queue',
    correlation_id: `TX-${Date.now()}`
  }, { headers });
  console.log('Enqueue response:', enqueue.data);

  console.log('Fetch delivery logs...');
  const logs = await axios.get(`${API}/delivery`, { headers, params: { limit: 5 } });
  console.log('Latest logs:', logs.data);
}

run().catch(e => console.error(e.response?.data || e.message));
