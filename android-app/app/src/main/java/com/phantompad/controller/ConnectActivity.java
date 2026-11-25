package com.phantompad.controller;

import android.content.Context;
import android.content.Intent;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.NetworkRequest;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.view.WindowManager;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;

import org.json.JSONObject;

import java.io.InputStream;
import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.HttpURLConnection;
import java.net.InetAddress;
import java.net.InterfaceAddress;
import java.net.NetworkInterface;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class ConnectActivity extends AppCompatActivity {
    public static final String EXTRA_AUTO_CONNECT_USB = "auto_connect_usb";
    private static final int DISCOVERY_PORT = 31980;
    private static final int DEFAULT_SERVER_PORT = 3000;
    private final Handler main = new Handler(Looper.getMainLooper());
    private final ExecutorService executor = Executors.newCachedThreadPool();
    private volatile boolean scanning;
    private volatile DatagramSocket discoverySocket;
    private volatile int scanGeneration;
    private boolean launching;
    private boolean autoConnectUsb = true;
    private TextView statusText;
    private LinearLayout discoveredList;
    private ConnectivityManager connectivityManager;
    private ConnectivityManager.NetworkCallback networkCallback;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_connect);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        autoConnectUsb = getIntent().getBooleanExtra(EXTRA_AUTO_CONNECT_USB, true);
        statusText = findViewById(R.id.status_text);
        discoveredList = findViewById(R.id.discovered_list);
        findViewById(R.id.scan_btn).setOnClickListener(v -> restartScan());

        connectivityManager = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
        setupNetworkListener();
    }

    private void setupNetworkListener() {
        if (connectivityManager == null) return;
        networkCallback = new ConnectivityManager.NetworkCallback() {
            @Override
            public void onAvailable(@NonNull Network network) {
                main.post(() -> {
                    if (!launching) restartScan();
                });
            }

            @Override
            public void onCapabilitiesChanged(@NonNull Network network, @NonNull NetworkCapabilities capabilities) {
                main.post(() -> {
                    if (!launching) restartScan();
                });
            }
        };

        try {
            NetworkRequest request = new NetworkRequest.Builder()
                    .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                    .build();
            connectivityManager.registerNetworkCallback(request, networkCallback);
        } catch (Exception ignored) {
            try {
                connectivityManager.registerDefaultNetworkCallback(networkCallback);
            } catch (Exception ignored2) {}
        }
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
        discoveredList.removeAllViews();
        findViewById(R.id.discovered_section).setVisibility(View.GONE);
        statusText.setText("Looking for PhantomPad PC…");
        executor.execute(() -> scanNetwork(generation));
    }

    private void stopScan() {
        scanning = false;
        scanGeneration++;
        DatagramSocket socket = discoverySocket;
        if (socket != null) {
            try { socket.close(); } catch (Exception ignored) {}
        }
    }

    private boolean isUsbCandidate(String ifName, String ip) {
        if (ip == null) return false;
        if ("127.0.0.1".equals(ip) || "localhost".equals(ip)) return true;
        String name = ifName != null ? ifName.toLowerCase(Locale.ROOT) : "";
        if (name.contains("rndis") || name.contains("usb") || name.contains("ncm") || name.contains("gadget")) {
            return true;
        }
        return ip.startsWith("192.168.42.");
    }

    private void scanNetwork(int generation) {
        Set<String> found = new HashSet<>();
        try (DatagramSocket socket = new DatagramSocket(0)) {
            discoverySocket = socket;
            socket.setBroadcast(true);
            socket.setSoTimeout(400);
            byte[] query = "PHANTOMPAD_DISCOVER".getBytes(StandardCharsets.UTF_8);
            long lastBroadcast = 0;

            // Immediate fast-probe on candidate USB & local addresses
            executor.execute(() -> fastProbeUsbCandidates(found, generation));

            while (scanning && generation == scanGeneration && !isFinishing() && !launching) {
                long now = System.currentTimeMillis();
                if (now - lastBroadcast >= 1000) {
                    broadcastQuery(socket, query);
                    lastBroadcast = now;
                }

                DatagramPacket packet = new DatagramPacket(new byte[512], 512);
                try {
                    socket.receive(packet);
                    JSONObject server = new JSONObject(new String(packet.getData(), 0, packet.getLength(), StandardCharsets.UTF_8));
                    if (!"PhantomPad".equals(server.optString("app"))) continue;
                    String ip = server.optString("ip", packet.getAddress().getHostAddress());
                    int port = server.optInt("port", DEFAULT_SERVER_PORT);
                    String name = server.optString("name", "PhantomPad PC");
                    boolean isUsb = server.optBoolean("isUsb", false) || isUsbCandidate(null, ip);
                    String key = ip + ":" + port;
                    if (port < 1 || port > 65535 || !found.add(key)) continue;

                    main.post(() -> {
                        if (isUsb && autoConnectUsb) {
                            // Plug & Play: Immediately auto-launch on USB tethering without extra steps
                            connectTo(ip, port, true);
                        } else {
                            addServer(name, ip, port, isUsb);
                        }
                    });
                } catch (java.net.SocketTimeoutException ignored) {
                } catch (Exception ignored) {
                }
            }
        } catch (Exception error) {
            if (scanning && generation == scanGeneration) {
                main.post(() -> statusText.setText("Network scan stopped. Tap Scan to try again."));
            }
        } finally {
            discoverySocket = null;
        }
    }

    private void broadcastQuery(DatagramSocket socket, byte[] query) {
        try {
            for (NetworkInterface network : Collections.list(NetworkInterface.getNetworkInterfaces())) {
                if (!network.isUp() || network.isLoopback()) continue;
                String ifName = network.getName();
                for (InterfaceAddress address : network.getInterfaceAddresses()) {
                    InetAddress broadcast = address.getBroadcast();
                    if (broadcast != null) {
                        try {
                            socket.send(new DatagramPacket(query, query.length, broadcast, DISCOVERY_PORT));
                        } catch (Exception ignored) {}
                    } else {
                        // Subnet broadcast fallback for RNDIS/USB tethering
                        byte[] ipBytes = address.getAddress().getAddress();
                        if (ipBytes.length == 4) {
                            ipBytes[3] = (byte) 255;
                            try {
                                InetAddress calculated = InetAddress.getByAddress(ipBytes);
                                socket.send(new DatagramPacket(query, query.length, calculated, DISCOVERY_PORT));
                            } catch (Exception ignored) {}
                        }
                    }

                    // On USB interfaces, send unicast discover to standard host positions
                    if (isUsbCandidate(ifName, address.getAddress().getHostAddress())) {
                        sendUsbUnicastQueries(socket, query, address.getAddress().getHostAddress());
                    }
                }
            }
        } catch (Exception ignored) {
        }
    }

    private void sendUsbUnicastQueries(DatagramSocket socket, byte[] query, String localIp) {
        int lastDot = localIp.lastIndexOf('.');
        if (lastDot <= 0) return;
        String prefix = localIp.substring(0, lastDot + 1);
        // Common PC host positions in Android USB tethering DHCP pools
        int[] hosts = {1, 2, 84, 100, 128, 129, 254};
        for (int h : hosts) {
            try {
                InetAddress target = InetAddress.getByName(prefix + h);
                socket.send(new DatagramPacket(query, query.length, target, DISCOVERY_PORT));
            } catch (Exception ignored) {}
        }
    }

    private void fastProbeUsbCandidates(Set<String> found, int generation) {
        List<String> candidates = new ArrayList<>();
        candidates.add("127.0.0.1"); // ADB reverse/forward port

        try {
            for (NetworkInterface network : Collections.list(NetworkInterface.getNetworkInterfaces())) {
                if (!network.isUp() || network.isLoopback()) continue;
                String ifName = network.getName();
                for (InterfaceAddress address : network.getInterfaceAddresses()) {
                    String ip = address.getAddress().getHostAddress();
                    if (isUsbCandidate(ifName, ip)) {
                        int lastDot = ip.lastIndexOf('.');
                        if (lastDot > 0) {
                            String prefix = ip.substring(0, lastDot + 1);
                            candidates.add(prefix + "1");
                            candidates.add(prefix + "2");
                            candidates.add(prefix + "84");
                            candidates.add(prefix + "100");
                            candidates.add(prefix + "128");
                            candidates.add(prefix + "254");
                        }
                    }
                }
            }
        } catch (Exception ignored) {}

        for (String host : candidates) {
            if (!scanning || generation != scanGeneration || launching) break;
            probeHost(host, DEFAULT_SERVER_PORT, found, true);
            probeHost(host, DEFAULT_SERVER_PORT + 1, found, true);
        }
    }

    private void probeHost(String ip, int port, Set<String> found, boolean isUsb) {
        String key = ip + ":" + port;
        if (found.contains(key)) return;
        HttpURLConnection conn = null;
        try {
            URL url = new URL("http://" + ip + ":" + port + "/api/info");
            conn = (HttpURLConnection) url.openConnection();
            conn.setConnectTimeout(300);
            conn.setReadTimeout(400);
            conn.setRequestMethod("GET");
            if (conn.getResponseCode() == 200) {
                InputStream in = conn.getInputStream();
                byte[] buf = new byte[1024];
                int read = in.read(buf);
                in.close();
                if (read > 0) {
                    JSONObject info = new JSONObject(new String(buf, 0, read, StandardCharsets.UTF_8));
                    int p = info.optInt("port", port);
                    if (found.add(ip + ":" + p)) {
                        String name = "PhantomPad PC";
                        main.post(() -> {
                            if (isUsb && autoConnectUsb) {
                                connectTo(ip, p, true);
                            } else {
                                addServer(name, ip, p, isUsb);
                            }
                        });
                    }
                }
            }
        } catch (Exception ignored) {
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    private void addServer(String name, String ip, int port, boolean isUsb) {
        if (isFinishing() || launching) return;
        findViewById(R.id.discovered_section).setVisibility(View.VISIBLE);
        statusText.setText("Found a PC. Tap to connect.");
        View item = getLayoutInflater().inflate(R.layout.item_discovered_server, discoveredList, false);
        ((TextView) item.findViewById(R.id.server_name)).setText(name + (isUsb ? " (USB 🔌)" : ""));
        ((TextView) item.findViewById(R.id.server_address)).setText(ip + ":" + port + (isUsb ? " · Plug & Play" : " · Tap to connect"));
        item.setOnClickListener(v -> connectTo(ip, port, isUsb));
        discoveredList.addView(item);
    }

    private void connectTo(String ip, int port, boolean isUsb) {
        if (launching) return;
        launching = true;
        stopScan();
        main.post(() -> statusText.setText(isUsb ? "Plug & Play USB PC found! Launching gamepad…" : "Connecting to PhantomPad…"));
        Intent intent = new Intent(this, MainActivity.class);
        intent.putExtra("server_url", "http://" + ip + ":" + port);
        intent.putExtra("pairing_code", "");
        intent.putExtra("is_usb", isUsb);
        startActivity(intent);
        finish();
    }

    @Override
    protected void onPause() {
        stopScan();
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        stopScan();
        if (connectivityManager != null && networkCallback != null) {
            try { connectivityManager.unregisterNetworkCallback(networkCallback); } catch (Exception ignored) {}
        }
        executor.shutdownNow();
        super.onDestroy();
    }
}