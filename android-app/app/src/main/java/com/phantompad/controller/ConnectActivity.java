package com.phantompad.controller;

import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.view.WindowManager;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;

import org.json.JSONObject;

import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.InetAddress;
import java.net.InterfaceAddress;
import java.net.NetworkInterface;
import java.util.Collections;
import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class ConnectActivity extends AppCompatActivity {
    private static final int DISCOVERY_PORT = 31980;
    private final Handler main = new Handler(Looper.getMainLooper());
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private volatile boolean scanning;
    private volatile DatagramSocket discoverySocket;
    private volatile int scanGeneration;
    private boolean launching;
    private TextView statusText;
    private LinearLayout discoveredList;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_connect);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        statusText = findViewById(R.id.status_text);
        discoveredList = findViewById(R.id.discovered_list);
        findViewById(R.id.scan_btn).setOnClickListener(v -> restartScan());
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (!launching) startScan();
    }

    private void restartScan() {
        stopScan();
        startScan();
    }

    private void startScan() {
        if (scanning) return;
        scanning = true;
        int generation = ++scanGeneration;
        statusText.setText("Looking for PhantomPad on your network…");
        executor.execute(() -> scanNetwork(generation));
    }

    private void stopScan() {
        scanning = false;
        scanGeneration++;
        DatagramSocket socket = discoverySocket;
        if (socket != null) socket.close();
    }

    private void scanNetwork(int generation) {
        Set<String> found = new HashSet<>();
        try (DatagramSocket socket = new DatagramSocket(0)) {
            discoverySocket = socket;
            socket.setBroadcast(true);
            socket.setSoTimeout(500);
            byte[] query = "PHANTOMPAD_DISCOVER".getBytes(java.nio.charset.StandardCharsets.UTF_8);
            long lastQuery = 0;
            while (scanning && generation == scanGeneration && !isFinishing()) {
                long now = System.currentTimeMillis();
                if (now - lastQuery >= 2000) {
                    broadcastQuery(socket, query);
                    lastQuery = now;
                }
                DatagramPacket packet = new DatagramPacket(new byte[512], 512);
                try {
                    socket.receive(packet);
                    JSONObject server = new JSONObject(new String(packet.getData(), 0, packet.getLength(), java.nio.charset.StandardCharsets.UTF_8));
                    if (!"PhantomPad".equals(server.optString("app"))) continue;
                    String ip = server.optString("ip", packet.getAddress().getHostAddress());
                    int port = server.optInt("port", 0);
                    String name = server.optString("name", "PhantomPad PC");
                    String key = ip + ":" + port;
                    if (port < 1 || port > 65535 || !found.add(key)) continue;
                    main.post(() -> addServer(name, ip, port));
                } catch (java.net.SocketTimeoutException ignored) {
                } catch (Exception ignored) {
                }
            }
        } catch (Exception error) {
            if (scanning && generation == scanGeneration) main.post(() -> statusText.setText("Network scan stopped. Tap Scan to try again."));
        } finally {
            discoverySocket = null;
        }
    }

    private void broadcastQuery(DatagramSocket socket, byte[] query) {
        try {
            for (NetworkInterface network : Collections.list(NetworkInterface.getNetworkInterfaces())) {
                if (!network.isUp() || network.isLoopback()) continue;
                for (InterfaceAddress address : network.getInterfaceAddresses()) {
                    InetAddress broadcast = address.getBroadcast();
                    if (broadcast != null) socket.send(new DatagramPacket(query, query.length, broadcast, DISCOVERY_PORT));
                }
            }
        } catch (Exception ignored) {
        }
    }

    private void addServer(String name, String ip, int port) {
        if (isFinishing()) return;
        findViewById(R.id.discovered_section).setVisibility(View.VISIBLE);
        statusText.setText("Found a PC. Tap its name to connect.");
        View item = getLayoutInflater().inflate(R.layout.item_discovered_server, discoveredList, false);
        ((TextView) item.findViewById(R.id.server_name)).setText(name);
        ((TextView) item.findViewById(R.id.server_address)).setText(ip + ":" + port + " · Tap to connect");
        item.setOnClickListener(v -> connectTo(ip, port));
        discoveredList.addView(item);
    }

    private void connectTo(String ip, int port) {
        if (launching) return;
        launching = true;
        stopScan();
        statusText.setText("Connecting to PhantomPad…");
        Intent intent = new Intent(this, MainActivity.class);
        intent.putExtra("server_url", "http://" + ip + ":" + port);
        intent.putExtra("pairing_code", "");
        startActivity(intent);
    }

    @Override
    protected void onPause() {
        stopScan();
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        stopScan();
        executor.shutdownNow();
        super.onDestroy();
    }
}
